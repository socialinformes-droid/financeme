# Fluxo de Caixa (Cashboxes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um módulo de fluxo de caixa (`/cashflow`) onde o usuário gerencia múltiplos "caixas" (categorias/metas como "Fundo Emergência", "Viagem 2026"), acompanhando previsto vs. real por mês e saldo acumulado, alimentado pelas transações de entrada existentes.

**Architecture:** Duas tabelas novas no Supabase (`cashboxes`, `cashbox_withdrawals`) + uma coluna nova (`cashbox_id`) em `transactions`, aplicável só a `type='income'`. Cálculos (previsto/real/saldo) vivem em funções puras testáveis em `lib/domain/cashboxes.ts`. UI segue o padrão Server Component (`page.tsx`, fetch) + Client Component (`_view.tsx`, interação) já usado em `cards/`, `transactions/`, `installments/`.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS), TypeScript manual (sem codegen), Vitest para testes de domínio, Tailwind + componentes `components/ui/*` (base-ui), `sonner` para toasts.

## Global Constraints

- `cashbox_id` só se aplica a `transactions` com `type='income'`. Despesas nunca recebem `cashbox_id` — fora de escopo (confirmado na spec).
- Retiradas (`cashbox_withdrawals`) NUNCA geram lançamento em `transactions` e NUNCA entram no cálculo de "gastos do mês" do Dashboard — são movimento interno do caixa.
- Retirada pode deixar o saldo do caixa negativo — sem bloqueio de validação.
- Excluir um caixa é permitido mesmo com histórico: transações vinculadas mantêm-se com `cashbox_id = null` (`on delete set null`); retiradas do caixa são removidas junto (`on delete cascade`).
- Cada caixa recebe exatamente sua `monthly_goal` do saldo previsto do mês — sem rateio proporcional.
- Nomenclatura: colunas em `snake_case`, inglês; textos de UI em português — seguindo o padrão já usado no restante do projeto.
- Sem React Query nem server actions no projeto — queries diretas via `supabase.from(...)` em Server Components (leitura) e Client Components (mutação), igual ao restante do código.
- Testes automatizados só existem em `lib/**/*.test.ts` (Vitest, ambiente node, sem jsdom/testing-library) — funções de domínio puras são testadas; UI é verificada manualmente via `npm run dev`.

---

### Task 1: Migration — tabelas `cashboxes`, `cashbox_withdrawals` e coluna `cashbox_id`

**Files:**
- Create: `supabase/migrations/0004_cashboxes.sql`

**Interfaces:**
- Produces: tabelas `cashboxes(id, user_id, name, monthly_goal, total_goal, created_at)` e `cashbox_withdrawals(id, user_id, cashbox_id, amount, withdrawal_date, note, created_at)`; coluna `transactions.cashbox_id` (nullable, FK, `on delete set null`).

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0004_cashboxes.sql
-- Fluxo de caixa: caixas (metas de acumulação) e retiradas.
-- cashbox_id em transactions só se aplica a type='income' — despesas não se
-- vinculam a caixa (ver docs/superpowers/specs/2026-08-06-fluxo-caixa-design.md).
-- Execute via Supabase SQL editor ou `supabase db push`.

create table if not exists cashboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  monthly_goal numeric,
  total_goal numeric,
  created_at timestamptz not null default now()
);

create index if not exists cashboxes_user_idx on cashboxes (user_id);

alter table cashboxes enable row level security;

drop policy if exists "cashboxes_owner" on cashboxes;
create policy "cashboxes_owner" on cashboxes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists cashbox_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cashbox_id uuid not null references cashboxes (id) on delete cascade,
  amount numeric not null,
  withdrawal_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cashbox_withdrawals_cashbox_idx on cashbox_withdrawals (cashbox_id);
create index if not exists cashbox_withdrawals_user_idx on cashbox_withdrawals (user_id);

alter table cashbox_withdrawals enable row level security;

drop policy if exists "cashbox_withdrawals_owner" on cashbox_withdrawals;
create policy "cashbox_withdrawals_owner" on cashbox_withdrawals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table transactions
  add column if not exists cashbox_id uuid references cashboxes (id) on delete set null;

create index if not exists transactions_cashbox_idx on transactions (cashbox_id);

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Aplicar a migration**

Run: `supabase db push` (se a CLI estiver configurada com o projeto linkado). Se não estiver, aplicar manualmente colando o SQL no Supabase SQL editor do projeto.

Expected: sem erros; `select * from cashboxes limit 1;` e `select cashbox_id from transactions limit 1;` executam sem erro no SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_cashboxes.sql
git commit -m "feat: add cashboxes and cashbox_withdrawals tables"
```

---

### Task 2: Tipos TypeScript do Supabase

**Files:**
- Modify: `lib/supabase/types.ts`

**Interfaces:**
- Consumes: nenhuma (arquivo de tipos, base pras próximas tasks)
- Produces: `CashboxRow`, `CashboxWithdrawalRow` (exports), `TransactionRow.cashbox_id: string | null`, `Database['public']['Tables']['transactions']['Insert']['cashbox_id']?: string | null` (opcional no insert).

- [ ] **Step 1: Adicionar `cashbox_id` a `transactions`**

Em `lib/supabase/types.ts`, dentro do bloco `transactions.Row` (depois de `card_id: string | null;`, por volta da linha 39), adicionar:

```ts
          card_id: string | null;
          cashbox_id: string | null;
```

Alterar o bloco `transactions.Insert` (linhas 50-56) de:

```ts
        Insert: Omit<
          Database['public']['Tables']['transactions']['Row'],
          'id' | 'created_at'
        > & {
          id?: string;
          created_at?: string;
        };
```

para (exclui `cashbox_id` do Omit e reintroduz como opcional — evita quebrar os insert calls existentes em `lib/domain/installments.ts` que constroem objetos sem `cashbox_id`):

```ts
        Insert: Omit<
          Database['public']['Tables']['transactions']['Row'],
          'id' | 'created_at' | 'cashbox_id'
        > & {
          id?: string;
          created_at?: string;
          cashbox_id?: string | null;
        };
```

- [ ] **Step 2: Adicionar tabelas `cashboxes` e `cashbox_withdrawals`**

Depois do bloco `recurring_income` (fecha na linha 157, antes de `};` que fecha `Tables`), adicionar:

```ts
      cashboxes: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          monthly_goal: number | null;
          total_goal: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          monthly_goal?: number | null;
          total_goal?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cashboxes']['Insert']>;
        Relationships: [];
      };
      cashbox_withdrawals: {
        Row: {
          id: string;
          user_id: string;
          cashbox_id: string;
          amount: number;
          withdrawal_date: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          cashbox_id: string;
          amount: number;
          withdrawal_date: string;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cashbox_withdrawals']['Insert']>;
        Relationships: [];
      };
```

- [ ] **Step 3: Exportar os tipos**

No final do arquivo, depois de `export type CategoryRow = ...` (linha 172), adicionar:

```ts
export type CashboxRow = Database['public']['Tables']['cashboxes']['Row'];
export type CashboxWithdrawalRow = Database['public']['Tables']['cashbox_withdrawals']['Row'];
```

- [ ] **Step 4: Verificar que o projeto tipa sem erros**

Run: `npx tsc --noEmit`
Expected: sem erros novos relacionados a `transactions`/`cashboxes` (erros pré-existentes, se houver, não são desta task).

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/types.ts
git commit -m "feat: add cashboxes types and cashbox_id on transactions"
```

---

### Task 3: Cálculos de domínio (previsto/real/saldo)

**Files:**
- Create: `lib/domain/cashboxes.ts`
- Test: `lib/domain/cashboxes.test.ts`

**Interfaces:**
- Consumes: `TransactionRow` de `@/lib/supabase/types` (Task 2)
- Produces: `calculateMonthlyForecastBalance(transactions, monthKey): number`, `cashboxMonthlyForecast(cashbox): number`, `cashboxRealMonth(cashboxId, monthKey, transactions, withdrawals): number`, `cashboxBalance(cashboxId, transactions, withdrawals): number`, `calculateAllocation(cashboxes, forecastBalance): { allocated: number; unallocated: number }`, tipos `CashboxLike`, `CashboxWithdrawalLike`, `CashboxTransactionLike`.

- [ ] **Step 1: Escrever os testes (falhando)**

```ts
// lib/domain/cashboxes.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyForecastBalance,
  cashboxMonthlyForecast,
  cashboxRealMonth,
  cashboxBalance,
  calculateAllocation,
  type CashboxTransactionLike,
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

function tx(over: Partial<CashboxTransactionLike>): CashboxTransactionLike {
  return {
    cashbox_id: 'c1',
    type: 'income',
    amount: 100,
    expense_month: '2026-08-01',
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
  it('soma entradas do mês vinculadas ao caixa, menos retiradas do mesmo mês', () => {
    const txs = [
      tx({ amount: 300, expense_month: '2026-08-01' }),
      tx({ amount: 200, expense_month: '2026-07-01' }), // outro mês
      tx({ cashbox_id: 'c2', amount: 999, expense_month: '2026-08-01' }), // outro caixa
      tx({ type: 'expense', amount: -50, expense_month: '2026-08-01' }), // despesa: nunca conta
    ];
    const withdrawals = [
      withdrawal({ amount: 100, withdrawal_date: '2026-08-15' }),
      withdrawal({ amount: 40, withdrawal_date: '2026-07-15' }), // outro mês
    ];
    expect(cashboxRealMonth('c1', '2026-08-01', txs, withdrawals)).toBe(200); // 300 - 100
  });

  it('retorna 0 sem entradas nem retiradas', () => {
    expect(cashboxRealMonth('c1', '2026-08-01', [], [])).toBe(0);
  });
});

describe('cashboxBalance', () => {
  it('soma entradas históricas menos retiradas históricas', () => {
    const txs = [
      tx({ amount: 300, expense_month: '2026-06-01' }),
      tx({ amount: 200, expense_month: '2026-08-01' }),
      tx({ cashbox_id: 'c2', amount: 999, expense_month: '2026-08-01' }),
    ];
    const withdrawals = [withdrawal({ amount: 700, withdrawal_date: '2026-08-15' })];
    expect(cashboxBalance('c1', txs, withdrawals)).toBe(-200); // 500 - 700
  });

  it('permite saldo negativo quando retirada > entradas', () => {
    const txs = [tx({ amount: 100 })];
    const withdrawals = [withdrawal({ amount: 250 })];
    expect(cashboxBalance('c1', txs, withdrawals)).toBe(-150);
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
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npm test -- lib/domain/cashboxes.test.ts`
Expected: FAIL — `Cannot find module './cashboxes'` (arquivo ainda não existe).

- [ ] **Step 3: Implementar `lib/domain/cashboxes.ts`**

```ts
import type { TransactionRow } from '@/lib/supabase/types';

export type CashboxLike = {
  id: string;
  monthly_goal: number | null;
};

export type CashboxWithdrawalLike = {
  cashbox_id: string;
  amount: number;
  withdrawal_date: string;
};

export type CashboxTransactionLike = Pick<
  TransactionRow,
  'cashbox_id' | 'type' | 'amount' | 'expense_month'
>;

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
  return cashbox.monthly_goal ?? 0;
}

/** Real do mês = entradas vinculadas ao caixa no mês, menos retiradas do mesmo mês. */
export function cashboxRealMonth(
  cashboxId: string,
  monthKey: string,
  transactions: CashboxTransactionLike[],
  withdrawals: CashboxWithdrawalLike[],
): number {
  const income = transactions
    .filter(
      (t) => t.cashbox_id === cashboxId && t.type === 'income' && t.expense_month === monthKey,
    )
    .reduce((a, t) => a + Number(t.amount), 0);
  const monthPrefix = monthKey.slice(0, 7);
  const withdrawn = withdrawals
    .filter((w) => w.cashbox_id === cashboxId && w.withdrawal_date.slice(0, 7) === monthPrefix)
    .reduce((a, w) => a + Number(w.amount), 0);
  return income - withdrawn;
}

/** Saldo acumulado (histórico total) = entradas - retiradas. Pode ser negativo. */
export function cashboxBalance(
  cashboxId: string,
  transactions: CashboxTransactionLike[],
  withdrawals: CashboxWithdrawalLike[],
): number {
  const income = transactions
    .filter((t) => t.cashbox_id === cashboxId && t.type === 'income')
    .reduce((a, t) => a + Number(t.amount), 0);
  const withdrawn = withdrawals
    .filter((w) => w.cashbox_id === cashboxId)
    .reduce((a, w) => a + Number(w.amount), 0);
  return income - withdrawn;
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
Expected: PASS — todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add lib/domain/cashboxes.ts lib/domain/cashboxes.test.ts
git commit -m "feat: add cashbox forecast/real/balance domain calculations"
```

---

### Task 4: Formulário de caixa (criar/editar)

**Files:**
- Create: `components/forms/cashbox-form.tsx`

**Interfaces:**
- Consumes: `CashboxRow`, `Database` de `@/lib/supabase/types` (Task 2); `createClient` de `@/lib/supabase/client`.
- Produces: `CashboxForm({ userId, editing, onDone })` — componente client, insere/atualiza em `cashboxes`.

- [ ] **Step 1: Implementar o componente**

```tsx
// components/forms/cashbox-form.tsx
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CashboxRow, Database } from '@/lib/supabase/types';

export type CashboxFormProps = {
  userId: string;
  editing?: CashboxRow | null;
  onDone?: () => void;
};

export function CashboxForm({ userId, editing, onDone }: CashboxFormProps) {
  const isEdit = !!editing;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(editing?.name ?? '');
  const [monthlyGoal, setMonthlyGoal] = useState(Number(editing?.monthly_goal ?? 0));
  const [totalGoal, setTotalGoal] = useState(Number(editing?.total_goal ?? 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Adicione um nome');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      type Insert = Database['public']['Tables']['cashboxes']['Insert'];
      const payload: Insert = {
        user_id: userId,
        name: name.trim(),
        monthly_goal: monthlyGoal || null,
        total_goal: totalGoal || null,
      };
      if (isEdit && editing) {
        const { error } = await supabase.from('cashboxes').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Caixa atualizado');
      } else {
        const { error } = await supabase.from('cashboxes').insert(payload);
        if (error) throw error;
        toast.success('Caixa criado');
      }
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
      <div className="space-y-1.5">
        <Label htmlFor="cashbox-name">Nome</Label>
        <Input
          id="cashbox-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fundo Emergência, Viagem 2026..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Meta mensal (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={monthlyGoal || ''}
            onChange={(e) => setMonthlyGoal(Number(e.target.value) || 0)}
            placeholder="0,00 (opcional)"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Meta total (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={totalGoal || ''}
            onChange={(e) => setTotalGoal(Number(e.target.value) || 0)}
            placeholder="0,00 (opcional)"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar caixa'}
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
git add components/forms/cashbox-form.tsx
git commit -m "feat: add cashbox create/edit form"
```

---

### Task 5: Formulário de retirada

**Files:**
- Create: `components/forms/cashbox-withdrawal-form.tsx`

**Interfaces:**
- Consumes: `Database` de `@/lib/supabase/types` (Task 2); `createClient`; `toISODate` de `@/lib/format`.
- Produces: `CashboxWithdrawalForm({ userId, cashboxId, onDone })` — insere em `cashbox_withdrawals`.

- [ ] **Step 1: Implementar o componente**

```tsx
// components/forms/cashbox-withdrawal-form.tsx
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

export type CashboxWithdrawalFormProps = {
  userId: string;
  cashboxId: string;
  onDone?: () => void;
};

export function CashboxWithdrawalForm({
  userId,
  cashboxId,
  onDone,
}: CashboxWithdrawalFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState(0);
  const [withdrawalDate, setWithdrawalDate] = useState(toISODate(new Date()));
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
      type Insert = Database['public']['Tables']['cashbox_withdrawals']['Insert'];
      const payload: Insert = {
        user_id: userId,
        cashbox_id: cashboxId,
        amount,
        withdrawal_date: withdrawalDate,
        note: note.trim() || null,
      };
      const { error } = await supabase.from('cashbox_withdrawals').insert(payload);
      if (error) throw error;
      toast.success('Retirada registrada');
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
            value={withdrawalDate}
            onChange={(e) => setWithdrawalDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="withdrawal-note">Nota (opcional)</Label>
        <Textarea
          id="withdrawal-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Salvando...' : 'Registrar retirada'}
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
git add components/forms/cashbox-withdrawal-form.tsx
git commit -m "feat: add cashbox withdrawal form"
```

---

### Task 6: Página `/cashflow` — dados, header e grid de caixas

**Files:**
- Create: `app/(app)/cashflow/page.tsx`
- Create: `app/(app)/cashflow/_view.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; `CashboxRow`, `CashboxWithdrawalRow`, `TransactionRow` de `@/lib/supabase/types` (Task 2); `calculateMonthlyForecastBalance`, `calculateAllocation`, `cashboxMonthlyForecast`, `cashboxRealMonth`, `cashboxBalance` de `@/lib/domain/cashboxes` (Task 3); `CashboxForm` (Task 4); `firstDayOfMonth`, `toISODate`, `formatBRL` de `@/lib/format`.
- Produces: rota `/cashflow` renderizando header + grid. `CashflowView` exporta também o estado `selected` que a Task 7 vai estender com o detalhe.

- [ ] **Step 1: Criar `page.tsx`**

```tsx
// app/(app)/cashflow/page.tsx
import { createClient } from '@/lib/supabase/server';
import { firstDayOfMonth, toISODate } from '@/lib/format';
import type { CashboxRow, CashboxWithdrawalRow, TransactionRow } from '@/lib/supabase/types';
import { CashflowView } from './_view';

export const dynamic = 'force-dynamic';

export default async function CashflowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const currentMonthKey = toISODate(firstDayOfMonth(new Date()));

  const [{ data: cashboxes }, { data: cashboxTxs }, { data: monthTxs }, { data: withdrawals }] =
    await Promise.all([
      supabase.from('cashboxes').select('*').order('created_at', { ascending: true }),
      supabase.from('transactions').select('*').eq('type', 'income').not('cashbox_id', 'is', null),
      supabase.from('transactions').select('*').eq('expense_month', currentMonthKey),
      supabase
        .from('cashbox_withdrawals')
        .select('*')
        .order('withdrawal_date', { ascending: false }),
    ]);

  return (
    <CashflowView
      userId={user.id}
      currentMonthKey={currentMonthKey}
      cashboxes={(cashboxes ?? []) as CashboxRow[]}
      cashboxTransactions={(cashboxTxs ?? []) as TransactionRow[]}
      monthTransactions={(monthTxs ?? []) as TransactionRow[]}
      withdrawals={(withdrawals ?? []) as CashboxWithdrawalRow[]}
    />
  );
}
```

- [ ] **Step 2: Criar `_view.tsx` (header + grid, sem detalhe ainda)**

```tsx
// app/(app)/cashflow/_view.tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatBRL } from '@/lib/format';
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
import type { CashboxRow, CashboxWithdrawalRow, TransactionRow } from '@/lib/supabase/types';

export function CashflowView({
  userId,
  currentMonthKey,
  cashboxes,
  cashboxTransactions,
  monthTransactions,
  withdrawals,
}: {
  userId: string;
  currentMonthKey: string;
  cashboxes: CashboxRow[];
  cashboxTransactions: TransactionRow[];
  monthTransactions: TransactionRow[];
  withdrawals: CashboxWithdrawalRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CashboxRow | null>(null);

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
      real: cashboxRealMonth(c.id, currentMonthKey, cashboxTransactions, withdrawals),
      balance: cashboxBalance(c.id, cashboxTransactions, withdrawals),
    }));
  }, [cashboxes, currentMonthKey, cashboxTransactions, withdrawals]);

  const remove = async (c: CashboxRow) => {
    if (
      !confirm(
        `Excluir "${c.name}"? As entradas já lançadas ficam no banco mas perdem o vínculo com este caixa.`,
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
            const progress = forecast > 0 ? Math.min(100, (real / forecast) * 100) : 0;
            const totalGoal = Number(cashbox.total_goal ?? 0);
            const totalProgress = totalGoal > 0 ? Math.min(100, (balance / totalGoal) * 100) : 0;
            return (
              <li key={cashbox.id}>
                <div className="rounded-lg border border-rule/60 bg-card overflow-hidden px-5 py-5 space-y-3">
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
                        onClick={() => setEditing(cashbox)}
                        disabled={pending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Excluir"
                        onClick={() => remove(cashbox)}
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
    </div>
  );
}
```

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev`, abrir `http://localhost:3000/cashflow`.
Expected: página carrega sem erro, mostra header com 3 métricas (todas R$ 0,00 sem caixas), estado vazio "Nenhum caixa ainda". Clicar "Novo caixa" abre o formulário, criar um caixa com meta mensal e conferir que aparece no grid com barra de progresso.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/cashflow/page.tsx" "app/(app)/cashflow/_view.tsx"
git commit -m "feat: add /cashflow page with header and cashbox grid"
```

---

### Task 7: Detalhe do caixa — histórico e retirada

**Files:**
- Modify: `app/(app)/cashflow/_view.tsx`

**Interfaces:**
- Consumes: `CashboxWithdrawalForm` (Task 5); `formatBRLSigned`, `formatDateBR` de `@/lib/format`.
- Produces: clique num card de caixa abre um Sheet de detalhe com histórico (entradas + retiradas, ordenado por data) e botão "Registrar retirada".

- [ ] **Step 1: Adicionar estado e import**

No topo de `_view.tsx`, adicionar aos imports existentes:

```tsx
import { formatBRLSigned, formatDateBR } from '@/lib/format';
import { CashboxWithdrawalForm } from '@/components/forms/cashbox-withdrawal-form';
```

Dentro de `CashflowView`, junto aos outros `useState`, adicionar:

```tsx
const [selected, setSelected] = useState<CashboxRow | null>(null);
const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
```

E um `useMemo` para o histórico do caixa selecionado, depois do `enriched`:

```tsx
const selectedHistory = useMemo(() => {
  if (!selected) return [];
  const incomeEntries = cashboxTransactions
    .filter((t) => t.cashbox_id === selected.id)
    .map((t) => ({
      id: t.id,
      date: t.transaction_date,
      amount: Number(t.amount),
      label: t.description,
      kind: 'income' as const,
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
  return [...incomeEntries, ...withdrawalEntries].sort((a, b) => b.date.localeCompare(a.date));
}, [selected, cashboxTransactions, withdrawals]);
```

- [ ] **Step 2: Tornar cada card clicável**

No `<li key={cashbox.id}>`, envolver o conteúdo com um `<button>` clicável (ou adicionar `onClick` na div raiz do card), preservando os botões de editar/excluir com `stopPropagation`. Trocar a abertura da `<div className="rounded-lg border ...">` por:

```tsx
<div
  className="rounded-lg border border-rule/60 bg-card overflow-hidden px-5 py-5 space-y-3 cursor-pointer hover:border-foreground/30 transition-colors"
  onClick={() => setSelected(cashbox)}
>
```

E nos dois botões (Editar/Excluir) já existentes, adicionar `onClick={(e) => { e.stopPropagation(); setEditing(cashbox); }}` e `onClick={(e) => { e.stopPropagation(); remove(cashbox); }}` respectivamente, substituindo os `onClick` atuais.

- [ ] **Step 3: Adicionar o Sheet de detalhe no fim do JSX**

Antes do `</div>` final que fecha o componente (depois do `</ul>` / bloco de estado vazio), adicionar:

```tsx
<Sheet
  open={!!selected}
  onOpenChange={(o) => {
    if (!o) {
      setSelected(null);
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
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowWithdrawalForm((v) => !v)}
      >
        {showWithdrawalForm ? 'Cancelar' : 'Registrar retirada'}
      </Button>

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
```

- [ ] **Step 4: Verificar manualmente**

Run: `npm run dev`, abrir `/cashflow`.
Expected: clicar num caixa abre o Sheet de detalhe. Clicar "Registrar retirada" mostra o formulário; salvar uma retirada atualiza o saldo do caixa (fecha formulário, refresh) e aparece no histórico com sinal negativo. Editar/excluir continuam funcionando sem abrir o detalhe (stopPropagation ok).

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/cashflow/_view.tsx"
git commit -m "feat: add cashbox detail view with history and withdrawal action"
```

---

### Task 8: Navegação — link no Sidebar

**Files:**
- Modify: `components/layout/sidebar.tsx`

**Interfaces:**
- Consumes: nenhuma nova.
- Produces: item "Fluxo de caixa" navegável em `/cashflow`.

- [ ] **Step 1: Adicionar o item de navegação**

Em `components/layout/sidebar.tsx`, no import de ícones (linha 15-24), adicionar `PiggyBank` à lista:

```tsx
import {
  LayoutDashboard,
  ArrowDownUp,
  CreditCard,
  ListChecks,
  ShoppingBag,
  TrendingUp,
  PiggyBank,
  Settings,
  LogOut,
} from 'lucide-react';
```

No array `NAV` (linhas 33-41), adicionar a entrada depois de `Previsão`:

```tsx
const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Lançamentos', icon: ArrowDownUp },
  { href: '/cards', label: 'Cartões', icon: CreditCard },
  { href: '/installments', label: 'Parcelas', icon: ListChecks },
  { href: '/shopping', label: 'Compras', icon: ShoppingBag },
  { href: '/forecast', label: 'Previsão', icon: TrendingUp },
  { href: '/cashflow', label: 'Fluxo de caixa', icon: PiggyBank },
  { href: '/settings', label: 'Edição', icon: Settings },
];
```

- [ ] **Step 2: Verificar manualmente**

Run: `npm run dev`.
Expected: item "Fluxo de caixa" aparece no menu lateral, navega pra `/cashflow`, fica destacado quando ativo.

- [ ] **Step 3: Commit**

```bash
git add components/layout/sidebar.tsx
git commit -m "feat: add cashflow link to sidebar nav"
```

---

### Task 9: Seletor de caixa no formulário de entrada

**Files:**
- Modify: `components/forms/transaction-form.tsx`

**Interfaces:**
- Consumes: `CashboxRow` de `@/lib/supabase/types` (Task 2, tipo usado apenas na prop, não importado diretamente — a prop aceita o shape mínimo).
- Produces: `TransactionFormProps.cashboxes?: ReadonlyArray<{ id: string; name: string }>` — quando `type === 'income'` e há caixas, mostra um select "Caixa (opcional)" que grava `cashbox_id`.

- [ ] **Step 1: Estender o schema e a prop**

Em `components/forms/transaction-form.tsx`, no `schema` (linhas 27-41), adicionar depois de `card_id: z.string().optional(),`:

```ts
  card_id: z.string().optional(),
  cashbox_id: z.string().optional(),
```

Em `TransactionFormProps` (linhas 45-55), adicionar depois de `categories?: ...`:

```ts
  /** Caixas do user (do DB), pra vincular entradas a uma meta. */
  cashboxes?: ReadonlyArray<{ id: string; name: string }>;
```

E no destructuring da função (linha 57), adicionar `cashboxes` com default vazio:

```ts
export function TransactionForm({
  userId,
  cards,
  categories,
  cashboxes = [],
  onDone,
  editing,
  onEditGroup,
}: TransactionFormProps) {
```

- [ ] **Step 2: Preencher `cashbox_id` nos defaultValues**

No `defaultValues` do modo edit (linhas 66-79), adicionar depois de `card_id: editing.card_id ?? undefined,`:

```ts
          card_id: editing.card_id ?? undefined,
          cashbox_id: editing.cashbox_id ?? undefined,
```

- [ ] **Step 3: Gravar `cashbox_id` nos inserts/update**

No bloco de UPDATE (modo edit, linhas 138-154), adicionar dentro do objeto passado a `.update(...)`, depois de `card_id: values.card_id ?? null,`:

```ts
            card_id: values.card_id ?? null,
            cashbox_id: values.type === 'income' ? (values.cashbox_id ?? null) : null,
```

No bloco de INSERT simples (linhas 197-216, o `else` final — não no de parcelas nem no de recorrência), adicionar depois de `card_id: values.card_id ?? null,`:

```ts
          card_id: values.card_id ?? null,
          cashbox_id: values.type === 'income' ? (values.cashbox_id ?? null) : null,
```

- [ ] **Step 4: Adicionar o campo no formulário**

Depois do `<div className="grid grid-cols-2 gap-3">` que contém Categoria/Cartão (fecha por volta da linha 348, antes do bloco `<div className="space-y-1.5"> <Label htmlFor="notes">`), adicionar:

```tsx
      {type === 'income' && cashboxes.length > 0 && (
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

- [ ] **Step 5: Verificar manualmente**

Run: `npm run dev`, abrir `/transactions`, criar um lançamento com Tipo = "Entrada" — sem passar `cashboxes` ainda (Task 10 faz o wiring), o campo não aparece (comportamento esperado, já que `cashboxes` tem default `[]`). Sem regressão no fluxo de despesa.

- [ ] **Step 6: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros novos.

- [ ] **Step 7: Commit**

```bash
git add components/forms/transaction-form.tsx
git commit -m "feat: add optional cashbox selector to income transactions"
```

---

### Task 10: Passar caixas pro formulário de lançamentos

**Files:**
- Modify: `app/(app)/transactions/page.tsx`
- Modify: `app/(app)/transactions/_view.tsx`

**Interfaces:**
- Consumes: `CashboxRow` de `@/lib/supabase/types` (Task 2); `TransactionForm` com prop `cashboxes` (Task 9).
- Produces: página `/transactions` populando o seletor de caixa no formulário de entrada.

- [ ] **Step 1: Buscar caixas em `page.tsx`**

Em `app/(app)/transactions/page.tsx`, no `Promise.all` que busca `byExpense`, `byBilling`, `cards`, `categories`, adicionar mais uma query:

```ts
  const [{ data: byExpense }, { data: byBilling }, { data: cards }, { data: categories }, { data: cashboxes }] =
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
      supabase.from('cashboxes').select('*').order('name'),
    ]);
```

E no import do topo, adicionar `CashboxRow`:

```ts
import type { TransactionRow, CardRow, CategoryRow, CashboxRow } from '@/lib/supabase/types';
```

No JSX de retorno (`<TransactionsView ... />`), adicionar a prop:

```tsx
  return (
    <TransactionsView
      userId={user.id}
      initialTransactions={(transactions ?? []) as TransactionRow[]}
      cards={(cards ?? []) as CardRow[]}
      categories={(categories ?? []) as CategoryRow[]}
      cashboxes={(cashboxes ?? []) as CashboxRow[]}
      year={year}
    />
  );
```

- [ ] **Step 2: Aceitar e repassar a prop em `_view.tsx`**

Em `app/(app)/transactions/_view.tsx`, localizar a assinatura de `TransactionsView` (props recebidas) e adicionar `cashboxes: CashboxRow[]` ao tipo de props, e `import type { CashboxRow } from '@/lib/supabase/types';` no topo (ou incluir no import já existente de tipos do supabase, se houver um agrupado).

No `<TransactionForm ... />` renderizado dentro do Sheet (por volta da linha 409, onde já passa `userId`, `cards`, `categories`, `editing`), adicionar `cashboxes={cashboxes}`:

```tsx
                <TransactionForm
                  key={editing?.id ?? 'new'}
                  userId={userId}
                  cards={cards}
                  categories={categories}
                  cashboxes={cashboxes}
                  editing={editing}
                  onDone={() => {
                    setOpen(false);
                    setEditing(null);
                    refresh();
                  }}
                  onEditGroup={editing ? () => openGroupEdit(editing) : undefined}
```

- [ ] **Step 3: Verificar manualmente**

Run: `npm run dev`, abrir `/transactions`, criar um lançamento com Tipo = "Entrada" e um caixa já cadastrado (criado na Task 6).
Expected: campo "Caixa (opcional)" aparece com a lista de caixas; selecionar um, salvar, e conferir em `/cashflow` que o saldo do caixo escolhido aumentou pelo valor lançado.

- [ ] **Step 4: Verificar tipos e rodar suíte completa**

Run: `npx tsc --noEmit && npm test`
Expected: sem erros; todos os testes (incluindo os novos de `lib/domain/cashboxes.test.ts` e os pré-existentes) passam.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/transactions/page.tsx" "app/(app)/transactions/_view.tsx"
git commit -m "feat: wire cashboxes into the transactions income form"
```

---

## Verificação final

- [ ] `npm test` — suíte completa passa.
- [ ] `npx tsc --noEmit` — sem erros de tipo.
- [ ] `npm run dev` — fluxo manual completo: criar caixa com meta mensal → lançar entrada vinculada em `/transactions` → conferir saldo/progresso em `/cashflow` → registrar retirada → conferir saldo negativo permitido → excluir caixa → conferir que a transação de entrada permanece em `/transactions` sem vínculo.
