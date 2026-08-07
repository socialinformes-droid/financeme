# Correção: Depósitos de Caixa Não Contam no Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o mecanismo de "vincular uma transação de entrada a um caixa" por um registro de depósito (`cashbox_deposits`) desacoplado de `transactions`, simétrico a `cashbox_withdrawals`, eliminando a duplicação de ganho no Dashboard.

**Architecture:** Nova tabela aditiva `cashbox_deposits` (mesmo padrão de `cashbox_withdrawals`). Os cálculos de domínio em `lib/domain/cashboxes.ts` trocam a fonte de "entradas" de `transactions` para `cashbox_deposits`. O seletor de caixa é removido do formulário de lançamento geral; em seu lugar, a página `/cashflow` ganha um botão "Registrar entrada" espelhando o já existente "Registrar retirada".

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS), TypeScript manual, Vitest, Tailwind + `components/ui/*`, `sonner`.

## Global Constraints

- `cashbox_deposits` é aditiva ao schema — `deposits` nunca gera lançamento em `transactions` e nunca entra no cálculo de "Saldo do mês" do Dashboard.
- `transactions.cashbox_id` permanece na tabela (não é removida via `drop column`), mas nenhum código novo grava nela. Linhas antigas com `cashbox_id` preenchido (se existirem) ficam órfãs — verificar manualmente com `select count(*) from transactions where cashbox_id is not null;` antes de aplicar a migration desta correção; conversão pra `cashbox_deposits` é manual, fora do escopo automatizado.
- Retirada e depósito seguem a mesma regra de correspondência de mês: prefixo `YYYY-MM` da data (`withdrawal_date`/`deposit_date`), não igualdade exata.
- Cada caixa recebe exatamente sua `monthly_goal` do saldo previsto do mês — sem rateio proporcional (`calculateAllocation`, inalterado por esta correção).
- Nomenclatura: colunas em `snake_case`, inglês; textos de UI em português.
- Sem React Query nem server actions — queries diretas via `supabase.from(...)`.
- Testes automatizados só em `lib/**/*.test.ts` (Vitest, node, sem jsdom) — UI verificada manualmente/por leitura cuidadosa.

---

### Task 1: Migration — tabela `cashbox_deposits`

**Files:**
- Create: `supabase/migrations/0005_cashbox_deposits.sql`

**Interfaces:**
- Produces: tabela `cashbox_deposits(id, user_id, cashbox_id, amount, deposit_date, note, created_at)`, FK `cashbox_id` com `on delete cascade`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0005_cashbox_deposits.sql
-- Depósito em caixa: espelho de cashbox_withdrawals, soma em vez de subtrair.
-- Substitui o modelo antigo de vincular cashbox_id a uma transação de
-- lançamento geral — depósitos não tocam `transactions` nem o Dashboard,
-- evitando duplicar ganho já contabilizado em outro lançamento (ver
-- docs/superpowers/specs/2026-08-07-fluxo-caixa-correcao-dashboard-design.md).
-- Execute via Supabase SQL editor ou `supabase db push`.

create table if not exists cashbox_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cashbox_id uuid not null references cashboxes (id) on delete cascade,
  amount numeric not null,
  deposit_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cashbox_deposits_cashbox_idx on cashbox_deposits (cashbox_id);
create index if not exists cashbox_deposits_user_idx on cashbox_deposits (user_id);

alter table cashbox_deposits enable row level security;

drop policy if exists "cashbox_deposits_owner" on cashbox_deposits;
create policy "cashbox_deposits_owner" on cashbox_deposits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar a migration**

Run: `supabase db push` (se a CLI estiver linkada), ou colar o SQL no Supabase SQL editor.

Expected: sem erros; `select * from cashbox_deposits limit 1;` executa sem erro.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_cashbox_deposits.sql
git commit -m "feat: add cashbox_deposits table"
```

---

### Task 2: Tipos TypeScript — `CashboxDepositRow`

**Files:**
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Produces: `CashboxDepositRow` (export), `Database['public']['Tables']['cashbox_deposits']`.

- [ ] **Step 1: Adicionar o bloco da tabela**

Em `lib/supabase/types.ts`, logo depois do bloco `cashbox_withdrawals` (fecha na linha 201, antes de `};` que fecha `Tables`), adicionar:

```ts
      cashbox_deposits: {
        Row: {
          id: string;
          user_id: string;
          cashbox_id: string;
          amount: number;
          deposit_date: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cashbox_id: string;
          amount: number;
          deposit_date: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cashbox_deposits']['Insert']>;
        Relationships: [];
      };
```

- [ ] **Step 2: Exportar o tipo**

No final do arquivo, depois de `export type CashboxWithdrawalRow = ...` (linha 218), adicionar:

```ts
export type CashboxDepositRow = Database['public']['Tables']['cashbox_deposits']['Row'];
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add CashboxDepositRow type"
```

---

### Task 3: Cálculos de domínio — trocar `transactions` por `cashbox_deposits`

**Files:**
- Modify: `lib/domain/cashboxes.ts`
- Modify: `lib/domain/cashboxes.test.ts`

**Interfaces:**
- Consumes: `TransactionRow` de `@/lib/supabase/types` (só usado por `calculateMonthlyForecastBalance`, inalterada).
- Produces: `CashboxDepositLike` (novo tipo, substitui `CashboxTransactionLike`), `cashboxRealMonth(cashboxId, monthKey, deposits, withdrawals): number`, `cashboxBalance(cashboxId, deposits, withdrawals): number` — assinaturas trocam o 3º parâmetro de `transactions: CashboxTransactionLike[]` para `deposits: CashboxDepositLike[]`.

- [ ] **Step 1: Reescrever os testes (falhando)**

Substituir o conteúdo inteiro de `lib/domain/cashboxes.test.ts` por:

```ts
import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyForecastBalance,
  cashboxMonthlyForecast,
  cashboxRealMonth,
  cashboxBalance,
  calculateAllocation,
  type CashboxDepositLike,
  type CashboxWithdrawalLike,
} from './cashboxes';

describe('calculateMonthlyForecastBalance', () => {
  it('soma entradas menos saídas do mês informado', () => {
    const txs = [
      { type: 'income' as const, amount: 5000, expense_month: '2026-08-01' },
      { type: 'expense' as const, amount: -2000, expense_month: '2026-08-01' },
      { type: 'income' as const, amount: 9999, expense_month: '2026-07-01' }, // fora do mês
    ];
    expect(calculateMonthlyForecastBalance(txs, '2026-08-01')).toBe(3000);
  });

  it('retorna 0 quando não há transações no mês', () => {
    expect(calculateMonthlyForecastBalance([], '2026-08-01')).toBe(0);
  });
});

describe('cashboxMonthlyForecast', () => {
  it('usa monthly_goal quando definida', () => {
    expect(cashboxMonthlyForecast({ id: 'c1', monthly_goal: 500 })).toBe(500);
  });

  it('retorna 0 quando monthly_goal é null', () => {
    expect(cashboxMonthlyForecast({ id: 'c1', monthly_goal: null })).toBe(0);
  });
});

function deposit(over: Partial<CashboxDepositLike>): CashboxDepositLike {
  return {
    cashbox_id: 'c1',
    amount: 100,
    deposit_date: '2026-08-01',
    ...over,
  };
}

function withdrawal(over: Partial<CashboxWithdrawalLike>): CashboxWithdrawalLike {
  return {
    cashbox_id: 'c1',
    amount: 50,
    withdrawal_date: '2026-08-10',
    ...over,
  };
}

describe('cashboxRealMonth', () => {
  it('soma depósitos do mês vinculados ao caixa, menos retiradas do mesmo mês', () => {
    const deposits = [
      deposit({ amount: 300, deposit_date: '2026-08-01' }),
      deposit({ amount: 200, deposit_date: '2026-07-01' }), // outro mês
      deposit({ cashbox_id: 'c2', amount: 999, deposit_date: '2026-08-01' }), // outro caixa
    ];
    const withdrawals = [
      withdrawal({ amount: 100, withdrawal_date: '2026-08-15' }),
      withdrawal({ amount: 40, withdrawal_date: '2026-07-15' }), // outro mês
    ];
    expect(cashboxRealMonth('c1', '2026-08-01', deposits, withdrawals)).toBe(200); // 300 - 100
  });

  it('retorna 0 sem depósitos nem retiradas', () => {
    expect(cashboxRealMonth('c1', '2026-08-01', [], [])).toBe(0);
  });
});

describe('cashboxBalance', () => {
  it('soma depósitos históricos menos retiradas históricas', () => {
    const deposits = [
      deposit({ amount: 300, deposit_date: '2026-06-01' }),
      deposit({ amount: 200, deposit_date: '2026-08-01' }),
      deposit({ cashbox_id: 'c2', amount: 999, deposit_date: '2026-08-01' }),
    ];
    const withdrawals = [withdrawal({ amount: 700, withdrawal_date: '2026-08-15' })];
    expect(cashboxBalance('c1', deposits, withdrawals)).toBe(-200); // 500 - 700
  });

  it('permite saldo negativo quando retirada > depósitos', () => {
    const deposits = [deposit({ amount: 100 })];
    const withdrawals = [withdrawal({ amount: 250 })];
    expect(cashboxBalance('c1', deposits, withdrawals)).toBe(-150);
  });

  it('retorna saldo negativo quando há retiradas mas nenhum depósito', () => {
    expect(cashboxBalance('c1', [], [withdrawal({ amount: 100 })])).toBe(-100);
  });
});

describe('calculateAllocation', () => {
  it('cada caixa recebe exatamente sua monthly_goal, resto vira não alocado', () => {
    const cashboxes = [
      { id: 'c1', monthly_goal: 2000 },
      { id: 'c2', monthly_goal: 1500 },
      { id: 'c3', monthly_goal: null },
    ];
    expect(calculateAllocation(cashboxes, 5000)).toEqual({ allocated: 3500, unallocated: 1500 });
  });

  it('unallocated fica negativo quando metas somadas excedem o previsto', () => {
    const cashboxes = [{ id: 'c1', monthly_goal: 6000 }];
    expect(calculateAllocation(cashboxes, 5000)).toEqual({ allocated: 6000, unallocated: -1000 });
  });

  it('sem caixas, tudo fica não alocado', () => {
    expect(calculateAllocation([], 5000)).toEqual({ allocated: 0, unallocated: 5000 });
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- lib/domain/cashboxes.test.ts`
Expected: FAIL — `CashboxDepositLike` não existe em `./cashboxes`, e/ou `cashboxRealMonth`/`cashboxBalance` recebem argumentos com shape errado pro código atual.

- [ ] **Step 3: Reescrever `lib/domain/cashboxes.ts`**

Substituir o conteúdo inteiro do arquivo por:

```ts
import type { TransactionRow } from '@/lib/supabase/types';

export type CashboxLike = {
  id: string;
  monthly_goal: number | null;
};

export type CashboxDepositLike = {
  cashbox_id: string;
  amount: number;
  deposit_date: string;
};

export type CashboxWithdrawalLike = {
  cashbox_id: string;
  amount: number;
  withdrawal_date: string;
};

/**
 * Saldo previsto do mês = entradas - saídas de transações cujo expense_month
 * é o mês informado. Mesma regra do card "Saldo do mês" do Dashboard.
 */
export function calculateMonthlyForecastBalance(
  transactions: Pick<TransactionRow, 'type' | 'amount' | 'expense_month'>[],
  monthKey: string,
): number {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.expense_month !== monthKey) continue;
    if (t.type === 'income') income += Number(t.amount);
    else expense += Math.abs(Number(t.amount));
  }
  return income - expense;
}

/** Previsto do mês pro caixa = monthly_goal, ou 0 se não definida. */
export function cashboxMonthlyForecast(cashbox: CashboxLike): number {
  return Number(cashbox.monthly_goal ?? 0);
}

/** Real do mês = depósitos no caixa no mês, menos retiradas do mesmo mês. */
export function cashboxRealMonth(
  cashboxId: string,
  monthKey: string,
  deposits: CashboxDepositLike[],
  withdrawals: CashboxWithdrawalLike[],
): number {
  const monthPrefix = monthKey.slice(0, 7);
  const deposited = deposits
    .filter((d) => d.cashbox_id === cashboxId && d.deposit_date.slice(0, 7) === monthPrefix)
    .reduce((a, d) => a + Number(d.amount), 0);
  const withdrawn = withdrawals
    .filter((w) => w.cashbox_id === cashboxId && w.withdrawal_date.slice(0, 7) === monthPrefix)
    .reduce((a, w) => a + Number(w.amount), 0);
  return deposited - withdrawn;
}

/** Saldo acumulado (histórico total) = depósitos - retiradas. Pode ser negativo. */
export function cashboxBalance(
  cashboxId: string,
  deposits: CashboxDepositLike[],
  withdrawals: CashboxWithdrawalLike[],
): number {
  const deposited = deposits
    .filter((d) => d.cashbox_id === cashboxId)
    .reduce((a, d) => a + Number(d.amount), 0);
  const withdrawn = withdrawals
    .filter((w) => w.cashbox_id === cashboxId)
    .reduce((a, w) => a + Number(w.amount), 0);
  return deposited - withdrawn;
}

export type AllocationSummary = { allocated: number; unallocated: number };

/**
 * Cada caixa recebe exatamente sua monthly_goal (sem rateio proporcional).
 * O que sobra do saldo previsto do mês fica "não alocado".
 */
export function calculateAllocation(
  cashboxes: CashboxLike[],
  forecastBalance: number,
): AllocationSummary {
  const allocated = cashboxes.reduce((a, c) => a + cashboxMonthlyForecast(c), 0);
  return { allocated, unallocated: forecastBalance - allocated };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npm test -- lib/domain/cashboxes.test.ts`
Expected: PASS — 12 testes verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/cashboxes.ts lib/domain/cashboxes.test.ts
git commit -m "refactor: cashbox real/balance calculations read cashbox_deposits instead of transactions"
```

---

### Task 4: Formulário de depósito

**Files:**
- Create: `components/forms/cashbox-deposit-form.tsx`

**Interfaces:**
- Consumes: `Database` de `@/lib/supabase/types` (Task 2); `createClient`; `toISODate` de `@/lib/format`.
- Produces: `CashboxDepositForm({ userId, cashboxId, onDone })` — insere em `cashbox_deposits`.

- [ ] **Step 1: Implementar o componente**

```tsx
// components/forms/cashbox-deposit-form.tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { toISODate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Database } from '@/lib/supabase/types';

export type CashboxDepositFormProps = {
  userId: string;
  cashboxId: string;
  onDone?: () => void;
};

export function CashboxDepositForm({
  userId,
  cashboxId,
  onDone,
}: CashboxDepositFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState(0);
  const [depositDate, setDepositDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      type Insert = Database['public']['Tables']['cashbox_deposits']['Insert'];
      const payload: Insert = {
        user_id: userId,
        cashbox_id: cashboxId,
        amount,
        deposit_date: depositDate,
        note: note.trim() || null,
      };
      const { error } = await supabase.from('cashbox_deposits').insert(payload);
      if (error) throw error;
      toast.success('Entrada registrada');
      setAmount(0);
      setNote('');
      onDone?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input
            type="date"
            value={depositDate}
            onChange={(e) => setDepositDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deposit-note">Nota (opcional)</Label>
        <Textarea
          id="deposit-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Salvando...' : 'Registrar entrada'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 3: Commit**

```bash
git add components/forms/cashbox-deposit-form.tsx
git commit -m "feat: add cashbox deposit form"
```

---

### Task 5: `/cashflow` — trocar transações por depósitos, adicionar "Registrar entrada"

**Files:**
- Modify: `app/(app)/cashflow/page.tsx`
- Modify: `app/(app)/cashflow/_view.tsx`

**Interfaces:**
- Consumes: `CashboxDepositRow` (Task 2), `cashboxRealMonth`/`cashboxBalance` com nova assinatura (Task 3), `CashboxDepositForm` (Task 4).
- Produces: página `/cashflow` com saldo de caixa calculado via `cashbox_deposits`, botão "Registrar entrada" no detalhe do caixa.

- [ ] **Step 1: Reescrever `page.tsx`**

Substituir o conteúdo inteiro por:

```tsx
// app/(app)/cashflow/page.tsx
import { createClient } from '@/lib/supabase/server';
import { firstDayOfMonth, toISODate } from '@/lib/format';
import type {
  CashboxRow,
  CashboxDepositRow,
  CashboxWithdrawalRow,
  TransactionRow,
} from '@/lib/supabase/types';
import { CashflowView } from './_view';

export const dynamic = 'force-dynamic';

export default async function CashflowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const currentMonthKey = toISODate(firstDayOfMonth(new Date()));

  const [
    { data: cashboxes, error: cashboxesError },
    { data: deposits, error: depositsError },
    { data: monthTxs, error: monthTxsError },
    { data: withdrawals, error: withdrawalsError },
  ] = await Promise.all([
    supabase.from('cashboxes').select('*').order('created_at', { ascending: true }),
    supabase
      .from('cashbox_deposits')
      .select('*')
      .order('deposit_date', { ascending: false })
      .limit(2000),
    supabase.from('transactions').select('*').eq('expense_month', currentMonthKey),
    supabase
      .from('cashbox_withdrawals')
      .select('*')
      .order('withdrawal_date', { ascending: false })
      .limit(2000),
  ]);

  if (cashboxesError) console.error('[cashflow cashboxes]', cashboxesError);
  if (depositsError) console.error('[cashflow deposits]', depositsError);
  if (monthTxsError) console.error('[cashflow monthTxs]', monthTxsError);
  if (withdrawalsError) console.error('[cashflow withdrawals]', withdrawalsError);

  return (
    <CashflowView
      userId={user.id}
      currentMonthKey={currentMonthKey}
      cashboxes={(cashboxes ?? []) as CashboxRow[]}
      deposits={(deposits ?? []) as CashboxDepositRow[]}
      monthTransactions={(monthTxs ?? []) as TransactionRow[]}
      withdrawals={(withdrawals ?? []) as CashboxWithdrawalRow[]}
    />
  );
}
```

- [ ] **Step 2: Reescrever `_view.tsx`**

Substituir o conteúdo inteiro por:

```tsx
// app/(app)/cashflow/_view.tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatBRL, formatBRLSigned, formatDateBR } from '@/lib/format';
import {
  calculateMonthlyForecastBalance,
  calculateAllocation,
  cashboxMonthlyForecast,
  cashboxRealMonth,
  cashboxBalance,
} from '@/lib/domain/cashboxes';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { CashboxForm } from '@/components/forms/cashbox-form';
import { CashboxDepositForm } from '@/components/forms/cashbox-deposit-form';
import { CashboxWithdrawalForm } from '@/components/forms/cashbox-withdrawal-form';
import type {
  CashboxRow,
  CashboxDepositRow,
  CashboxWithdrawalRow,
  TransactionRow,
} from '@/lib/supabase/types';

export function CashflowView({
  userId,
  currentMonthKey,
  cashboxes,
  deposits,
  monthTransactions,
  withdrawals,
}: {
  userId: string;
  currentMonthKey: string;
  cashboxes: CashboxRow[];
  deposits: CashboxDepositRow[];
  monthTransactions: TransactionRow[];
  withdrawals: CashboxWithdrawalRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CashboxRow | null>(null);
  const [selected, setSelected] = useState<CashboxRow | null>(null);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);

  const refresh = () => startTransition(() => router.refresh());

  const forecastBalance = useMemo(
    () => calculateMonthlyForecastBalance(monthTransactions, currentMonthKey),
    [monthTransactions, currentMonthKey],
  );

  const allocation = useMemo(
    () => calculateAllocation(cashboxes, forecastBalance),
    [cashboxes, forecastBalance],
  );

  const enriched = useMemo(() => {
    return cashboxes.map((c) => ({
      cashbox: c,
      forecast: cashboxMonthlyForecast(c),
      real: cashboxRealMonth(c.id, currentMonthKey, deposits, withdrawals),
      balance: cashboxBalance(c.id, deposits, withdrawals),
    }));
  }, [cashboxes, currentMonthKey, deposits, withdrawals]);

  const selectedHistory = useMemo(() => {
    if (!selected) return [];
    const depositEntries = deposits
      .filter((d) => d.cashbox_id === selected.id)
      .map((d) => ({
        id: d.id,
        date: d.deposit_date,
        amount: Number(d.amount),
        label: d.note?.trim() || 'Entrada',
        kind: 'deposit' as const,
      }));
    const withdrawalEntries = withdrawals
      .filter((w) => w.cashbox_id === selected.id)
      .map((w) => ({
        id: w.id,
        date: w.withdrawal_date,
        amount: -Number(w.amount),
        label: w.note?.trim() || 'Retirada',
        kind: 'withdrawal' as const,
      }));
    return [...depositEntries, ...withdrawalEntries].sort((a, b) => b.date.localeCompare(a.date));
  }, [selected, deposits, withdrawals]);

  const remove = async (c: CashboxRow) => {
    if (
      !confirm(
        `Excluir "${c.name}"? O histórico de entradas e retiradas deste caixa será apagado junto.`,
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from('cashboxes').delete().eq('id', c.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Caixa excluído');
      refresh();
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-4 border-b border-rule/60">
        <div>
          <p className="eyebrow">Caderno de</p>
          <h2 className="headline text-4xl font-light tracking-tight">Fluxo de caixa</h2>
          <p className="text-xs italic text-muted-foreground mt-1.5">
            {cashboxes.length} {cashboxes.length === 1 ? 'caixa cadastrado' : 'caixas cadastrados'}
          </p>
        </div>

        <Sheet
          open={open || !!editing}
          onOpenChange={(o) => {
            if (!o) {
              setOpen(false);
              setEditing(null);
            }
          }}
        >
          <SheetTrigger render={<Button />} onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo caixa
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? 'Editar caixa' : 'Novo caixa'}</SheetTitle>
              <SheetDescription>
                Meta mensal e meta total são opcionais.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 px-4 pb-4">
              <CashboxForm
                key={editing?.id ?? 'new'}
                userId={userId}
                editing={editing}
                onDone={() => {
                  setOpen(false);
                  setEditing(null);
                  refresh();
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule/60 border border-rule/60 rounded-lg overflow-hidden">
        <div className="bg-card px-4 py-4">
          <p className="eyebrow truncate">Saldo previsto do mês</p>
          <p className="mt-2 font-mono text-lg md:text-xl tabular-nums text-foreground">
            {formatBRL(forecastBalance)}
          </p>
        </div>
        <div className="bg-card px-4 py-4">
          <p className="eyebrow truncate">Alocado em metas</p>
          <p className="mt-2 font-mono text-lg md:text-xl tabular-nums text-foreground">
            {formatBRL(allocation.allocated)}
          </p>
        </div>
        <div className="bg-card px-4 py-4">
          <p className="eyebrow truncate">Não alocado</p>
          <p
            className={`mt-2 font-mono text-lg md:text-xl tabular-nums ${
              allocation.unallocated >= 0 ? 'text-money-up' : 'text-money-down'
            }`}
          >
            {formatBRL(allocation.unallocated)}
          </p>
        </div>
      </section>

      {cashboxes.length === 0 ? (
        <div className="text-center py-16">
          <PiggyBank className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" strokeWidth={1.5} />
          <p className="text-sm italic text-muted-foreground">
            Nenhum caixa ainda. Crie um pra começar a acompanhar suas metas.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enriched.map(({ cashbox, forecast, real, balance }) => {
            const progress = forecast > 0 ? Math.max(0, Math.min(100, (real / forecast) * 100)) : 0;
            const totalGoal = Number(cashbox.total_goal ?? 0);
            const totalProgress =
              totalGoal > 0 ? Math.max(0, Math.min(100, (balance / totalGoal) * 100)) : 0;
            return (
              <li key={cashbox.id}>
                <div
                  className="rounded-lg border border-rule/60 bg-card overflow-hidden px-5 py-5 space-y-3 cursor-pointer hover:border-foreground/30 transition-colors"
                  onClick={() => setSelected(cashbox)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl tracking-tight">{cashbox.name}</h3>
                      <p className="text-[11px] italic text-muted-foreground mt-1">
                        Saldo acumulado
                      </p>
                      <p
                        className={`font-mono text-2xl tabular-nums ${
                          balance >= 0 ? 'text-money-up' : 'text-money-down'
                        }`}
                      >
                        {formatBRL(balance)}
                      </p>
                    </div>
                    <div className="flex gap-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Editar"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(cashbox);
                        }}
                        disabled={pending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Excluir"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(cashbox);
                        }}
                        disabled={pending}
                        className="text-money-down hover:text-money-down"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {forecast > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Este mês</span>
                        <span className="font-mono tabular-nums">
                          {formatBRL(real)} / {formatBRL(forecast)}
                        </span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  )}

                  {totalGoal > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Meta total</span>
                        <span className="font-mono tabular-nums">
                          {formatBRL(balance)} / {formatBRL(totalGoal)}
                        </span>
                      </div>
                      <Progress value={totalProgress} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setShowDepositForm(false);
            setShowWithdrawalForm(false);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selected?.name}</SheetTitle>
            <SheetDescription>Histórico de entradas e retiradas deste caixa.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDepositForm((v) => !v);
                  setShowWithdrawalForm(false);
                }}
              >
                {showDepositForm ? 'Cancelar' : 'Registrar entrada'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowWithdrawalForm((v) => !v);
                  setShowDepositForm(false);
                }}
              >
                {showWithdrawalForm ? 'Cancelar' : 'Registrar retirada'}
              </Button>
            </div>

            {showDepositForm && selected && (
              <CashboxDepositForm
                userId={userId}
                cashboxId={selected.id}
                onDone={() => {
                  setShowDepositForm(false);
                  refresh();
                }}
              />
            )}

            {showWithdrawalForm && selected && (
              <CashboxWithdrawalForm
                userId={userId}
                cashboxId={selected.id}
                onDone={() => {
                  setShowWithdrawalForm(false);
                  refresh();
                }}
              />
            )}

            {selectedHistory.length === 0 ? (
              <p className="text-sm italic text-muted-foreground text-center py-6">
                Nenhuma movimentação ainda.
              </p>
            ) : (
              <ul className="divide-y divide-rule/40">
                {selectedHistory.map((entry) => (
                  <li key={`${entry.kind}-${entry.id}`} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <p className="font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">{formatDateBR(entry.date)}</p>
                    </div>
                    <span
                      className={`font-mono tabular-nums ${
                        entry.amount >= 0 ? 'text-money-up' : 'text-money-down'
                      }`}
                    >
                      {formatBRLSigned(entry.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev`, abrir `/cashflow` (login necessário — se não houver sessão disponível, confirmar ao menos que a rota compila e redireciona pro login, igual às tasks anteriores desse módulo).
Expected: página carrega; clicar num caixa abre o detalhe com dois botões ("Registrar entrada" e "Registrar retirada"); registrar uma entrada soma no saldo do caixa e aparece no histórico com sinal positivo, sem alterar nada no Dashboard.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/cashflow/page.tsx" "app/(app)/cashflow/_view.tsx"
git commit -m "feat: wire cashbox deposits into /cashflow, add Registrar entrada"
```

---

### Task 6: Reverter seletor de caixa no formulário de lançamento

**Files:**
- Modify: `components/forms/transaction-form.tsx`

**Interfaces:**
- Produces: `TransactionFormProps` sem `cashboxes`; formulário de entrada não grava mais `cashbox_id`.

- [ ] **Step 1: Remover do schema zod**

Remover a linha `cashbox_id: z.string().optional(),` (linha 35) do objeto `schema`.

- [ ] **Step 2: Remover da prop e do destructuring**

Remover de `TransactionFormProps` (linhas 51-52):
```ts
  /** Caixas do user (do DB), pra vincular entradas a uma meta. */
  cashboxes?: ReadonlyArray<{ id: string; name: string }>;
```

E do destructuring da função (linha 64), remover `cashboxes = [],`:
```ts
export function TransactionForm({
  userId,
  cards,
  categories,
  onDone,
  editing,
  onEditGroup,
}: TransactionFormProps) {
```

- [ ] **Step 3: Remover de `defaultValues`**

Remover a linha `cashbox_id: editing.cashbox_id ?? undefined,` (linha 86) do bloco `defaultValues` em modo edit.

- [ ] **Step 4: Remover dos payloads de UPDATE e INSERT**

No bloco UPDATE (linha 162), remover:
```ts
            cashbox_id: values.type === 'income' ? (values.cashbox_id ?? null) : null,
```

No bloco INSERT simples (linha 221), remover a mesma linha (mesmo texto, ocorrência diferente).

- [ ] **Step 5: Remover o campo JSX**

Remover o bloco inteiro (linhas 364-386):
```tsx
      {type === 'income' && !isRecurring && cashboxes.length > 0 && (
        <div className="space-y-1.5">
          <Label>Caixa (opcional)</Label>
          <Controller
            name="cashbox_id"
            control={form.control}
            render={({ field }) => (
              <Select
                value={field.value ?? '__none'}
                onValueChange={(v) => field.onChange(v === '__none' ? undefined : v)}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Nenhum</SelectItem>
                  {cashboxes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}
```

- [ ] **Step 6: Verificar manualmente**

Run: `npm run dev`, abrir `/transactions`, criar uma entrada — confirmar que não existe mais nenhum campo "Caixa" no formulário, e que despesa/parcelamento/recorrência continuam funcionando normalmente.

- [ ] **Step 7: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos. (Espera-se um erro em `app/(app)/transactions/_view.tsx` e `page.tsx`, que ainda passam a prop `cashboxes` — resolvido na Task 7.)

- [ ] **Step 8: Commit**

```bash
git add components/forms/transaction-form.tsx
git commit -m "revert: remove cashbox selector from income transaction form"
```

---

### Task 7: Reverter wiring de caixas em `/transactions`

**Files:**
- Modify: `app/(app)/transactions/page.tsx`
- Modify: `app/(app)/transactions/_view.tsx`

**Interfaces:**
- Produces: `/transactions` sem query, prop ou import de `cashboxes`/`CashboxRow`.

- [ ] **Step 1: Reverter `page.tsx`**

Remover `CashboxRow` do import de tipos (linha 2):
```ts
import type { TransactionRow, CardRow, CategoryRow } from '@/lib/supabase/types';
```

Remover a query de `cashboxes` do `Promise.all` (linhas 24-47), voltando a:
```ts
  const [{ data: byExpense }, { data: byBilling }, { data: cards }, { data: categories }] =
    await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .gte('expense_month', startOfYear)
        .lt('expense_month', endOfYear)
        .order('transaction_date', { ascending: false })
        .limit(2000),
      supabase
        .from('transactions')
        .select('*')
        .gte('billing_month', startOfYear)
        .lt('billing_month', endOfYear)
        .order('transaction_date', { ascending: false })
        .limit(2000),
      supabase.from('cards').select('*').order('name'),
      supabase.from('categories').select('*').eq('is_active', true).order('name'),
    ]);
```

Remover a prop `cashboxes={(cashboxes ?? []) as CashboxRow[]}` do `<TransactionsView ... />` (linha 65).

- [ ] **Step 2: Reverter `_view.tsx`**

Remover `CashboxRow` do import de tipos (linha 52).

Remover `cashboxes,` do destructuring de props de `TransactionsView` (linha 208) e `cashboxes: CashboxRow[];` do tipo das props (linha 215).

Remover `cashboxes={cashboxes}` da chamada `<TransactionForm ... />` (linha 416).

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev`, abrir `/transactions`, confirmar que a listagem e o formulário de novo lançamento continuam funcionando (criar entrada e despesa).

- [ ] **Step 4: Verificar tipos e rodar suíte completa**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros; suíte completa (12 testes de `cashboxes.test.ts` + 8 de `card-fatura-composition.test.ts` = 20) passando.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/transactions/page.tsx" "app/(app)/transactions/_view.tsx"
git commit -m "revert: remove cashboxes wiring from transactions page"
```

---

## Verificação final

- [ ] `npm test` — suíte completa passa (20/20).
- [ ] `npx tsc --noEmit` — sem erros de tipo.
- [ ] `npm run dev` — fluxo manual: criar caixa → "Registrar entrada" de R$500 → conferir saldo em `/cashflow` → conferir que o Dashboard **não** mudou → "Registrar retirada" de R$100 → saldo cai pra R$400 → excluir caixa e confirmar que histórico de entradas/retiradas some junto (cascade), sem afetar nenhuma transação em `/transactions`.
- [ ] Antes de aplicar a migration em produção: `select count(*) from transactions where cashbox_id is not null;` — se houver linhas, decidir manualmente conversão pra `cashbox_deposits` ou descarte do vínculo.
