# Extrato Comparativo de Cartões — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma seção "Extrato comparativo" na tela de Cartões onde o usuário seleciona até 3 cartões e vê o extrato de cada um lado a lado, num mês único, com lançamentos agrupados em fixos / parcelados / avulsos.

**Architecture:** Extrai a lógica de composição da fatura (hoje embutida no `FaturaGrid`) para um helper puro em `lib/domain/card-fatura-composition.ts` (testado com Vitest). Um novo Client Component `ExtratoComparativo` consome esse helper e é inserido na `_view.tsx` da tela de Cartões, reusando as props (`cards`, `transactions`, `year`) que a página já carrega — sem nova query.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind, Supabase, Base UI. Testes: Vitest (introduzido por este plano, só para lib pura).

---

## File Structure

- **Create** `lib/domain/card-fatura-composition.ts` — helper puro: `isLumpFatura`, `composeFatura`, tipos `FaturaLine`/`FaturaComposition`.
- **Create** `lib/domain/card-fatura-composition.test.ts` — testes unitários do helper.
- **Create** `vitest.config.ts` — config mínima do Vitest (node env, sem JSX).
- **Modify** `package.json` — devDep `vitest` + script `test`.
- **Modify** `components/cards/fatura-grid.tsx:48` — usar `isLumpFatura` em vez da expressão inline.
- **Create** `components/cards/extrato-comparativo.tsx` — Client Component da seção comparativa.
- **Modify** `app/(app)/cards/_view.tsx` — inserir `<ExtratoComparativo>` entre o `FaturaGrid` e o bloco "Por cartão".

---

## Task 1: Setup Vitest + helper de composição (TDD)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Create: `lib/domain/card-fatura-composition.ts`
- Test: `lib/domain/card-fatura-composition.test.ts`

- [ ] **Step 1: Instalar Vitest**

Run:
```bash
cd ~/projetos/financeiro && npm install -D vitest@^3
```
Expected: adiciona `vitest` em devDependencies sem erros.

- [ ] **Step 2: Criar config do Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 3: Adicionar script de teste**

Em `package.json`, dentro de `"scripts"`, adicionar a linha após `"lint": "eslint"`:
```json
    "lint": "eslint",
    "test": "vitest run"
```
(Garanta a vírgula após `"eslint"`.)

- [ ] **Step 4: Escrever os testes (devem falhar)**

Create `lib/domain/card-fatura-composition.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isLumpFatura, composeFatura } from './card-fatura-composition';
import type { TransactionRow } from '@/lib/supabase/types';

// fábrica mínima — só os campos que o helper lê
function tx(over: Partial<TransactionRow>): TransactionRow {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    description: 'x',
    amount: 100,
    type: 'expense',
    payment_method: 'credit',
    category: 'Outros',
    notes: null,
    expense_month: null,
    billing_month: '2026-06-01',
    card_id: 'c1',
    is_recurring: false,
    is_paid: false,
    transaction_date: '2026-06-01',
    is_installment: false,
    installment_number: null,
    total_installments: null,
    installment_group_id: null,
    installment_end_date: null,
    created_at: '2026-06-01T00:00:00Z',
    ...over,
  } as TransactionRow;
}

describe('isLumpFatura', () => {
  it('é true para category Cartão sem parênteses', () => {
    expect(isLumpFatura(tx({ category: 'Cartão', description: 'Fatura junho' }))).toBe(true);
  });
  it('é false para category Cartão itemizada (com parênteses)', () => {
    expect(isLumpFatura(tx({ category: 'Cartão', description: 'Netflix (3/10)' }))).toBe(false);
  });
  it('é false para outras categorias', () => {
    expect(isLumpFatura(tx({ category: 'Streaming', description: 'Netflix' }))).toBe(false);
  });
});

describe('composeFatura', () => {
  const cardId = 'c1';
  const month = '2026-06-01';

  it('classifica de forma exclusiva: recorrente > parcelado > avulso', () => {
    const txs = [
      tx({ is_recurring: true, amount: 50, description: 'Spotify' }),
      tx({ is_installment: true, installment_number: 3, total_installments: 10, amount: 200, description: 'TV (3/10)' }),
      tx({ amount: 30, description: 'Padaria' }),
      // recorrente E parcelado cai em fixos (recorrente vem primeiro)
      tx({ is_recurring: true, is_installment: true, amount: 70, description: 'Plano' }),
    ];
    const c = composeFatura(txs, cardId, month);
    expect(c.fixed).toHaveLength(2);
    expect(c.installments).toHaveLength(1);
    expect(c.oneOff).toHaveLength(1);
    expect(c.fixedTotal).toBe(120);
    expect(c.installmentsTotal).toBe(200);
    expect(c.oneOffTotal).toBe(30);
    expect(c.total).toBe(350);
  });

  it('inclui a linha base não-itemizada em oneOff via baseAmount', () => {
    const txs = [
      tx({ category: 'Cartão', description: 'Fatura junho', amount: 500 }),
      tx({ amount: 30, description: 'Padaria' }),
    ];
    const c = composeFatura(txs, cardId, month);
    expect(c.baseAmount).toBe(500);
    expect(c.oneOff).toHaveLength(1); // a base não vira linha de lista
    expect(c.oneOffTotal).toBe(530);
    expect(c.total).toBe(530);
  });

  it('ignora placeholders (Cartão com amount 0)', () => {
    const txs = [tx({ category: 'Cartão', description: 'Fatura', amount: 0 })];
    const c = composeFatura(txs, cardId, month);
    expect(c.total).toBe(0);
    expect(c.baseAmount).toBe(0);
  });

  it('filtra por cartão e mês e ignora income', () => {
    const txs = [
      tx({ amount: 30 }),
      tx({ card_id: 'outro', amount: 999 }),
      tx({ billing_month: '2026-07-01', amount: 888 }),
      tx({ type: 'income', amount: 777 }),
      tx({ billing_month: null, amount: 666 }),
    ];
    const c = composeFatura(txs, cardId, month);
    expect(c.total).toBe(30);
  });

  it('monta installmentLabel a partir de number/total', () => {
    const txs = [tx({ is_installment: true, installment_number: 3, total_installments: 10, description: 'TV' })];
    const c = composeFatura(txs, cardId, month);
    expect(c.installments[0].installmentLabel).toBe('3/10');
  });
});
```

- [ ] **Step 5: Rodar os testes (verificar que falham)**

Run: `cd ~/projetos/financeiro && npm test`
Expected: FAIL — `card-fatura-composition.ts` não existe / exports indefinidos.

- [ ] **Step 6: Implementar o helper**

Create `lib/domain/card-fatura-composition.ts`:
```ts
import type { TransactionRow } from '@/lib/supabase/types';

export type FaturaLine = {
  tx: TransactionRow;
  /** ex.: "3/10" — presente só em parcelados com número/total */
  installmentLabel?: string;
};

export type FaturaComposition = {
  fixed: FaturaLine[];
  installments: FaturaLine[];
  oneOff: FaturaLine[];
  /** soma das linhas "base" não-itemizadas (category=Cartão, amount != 0) */
  baseAmount: number;
  fixedTotal: number;
  installmentsTotal: number;
  /** inclui baseAmount */
  oneOffTotal: number;
  total: number;
};

/** Linha "base" da fatura: o resto não-detalhado do extrato. */
export function isLumpFatura(t: TransactionRow): boolean {
  return t.category === 'Cartão' && !t.description.includes('(');
}

const abs = (v: TransactionRow['amount']) => Math.abs(Number(v));

/**
 * Compõe a fatura de um cartão num mês a partir da lista completa de transações.
 * Classificação exclusiva por linha: recorrente > parcelado > avulso.
 * Linhas base (lump) com amount != 0 entram só no total de avulsos (baseAmount),
 * sem virar item de lista. Placeholders (lump com amount 0) são ignorados.
 */
export function composeFatura(
  transactions: TransactionRow[],
  cardId: string,
  billingMonth: string,
): FaturaComposition {
  const fixed: FaturaLine[] = [];
  const installments: FaturaLine[] = [];
  const oneOff: FaturaLine[] = [];
  let baseAmount = 0;

  for (const t of transactions) {
    if (t.card_id !== cardId || t.billing_month !== billingMonth) continue;
    if (t.type !== 'expense') continue;

    if (isLumpFatura(t)) {
      baseAmount += abs(t.amount); // amount 0 (placeholder) não soma nada
      continue;
    }

    if (t.is_recurring) {
      fixed.push({ tx: t });
    } else if (t.is_installment) {
      const label =
        t.installment_number && t.total_installments
          ? `${t.installment_number}/${t.total_installments}`
          : undefined;
      installments.push({ tx: t, installmentLabel: label });
    } else {
      oneOff.push({ tx: t });
    }
  }

  const sum = (lines: FaturaLine[]) => lines.reduce((a, l) => a + abs(l.tx.amount), 0);
  const fixedTotal = sum(fixed);
  const installmentsTotal = sum(installments);
  const oneOffTotal = sum(oneOff) + baseAmount;

  return {
    fixed,
    installments,
    oneOff,
    baseAmount,
    fixedTotal,
    installmentsTotal,
    oneOffTotal,
    total: fixedTotal + installmentsTotal + oneOffTotal,
  };
}
```

- [ ] **Step 7: Rodar os testes (verificar que passam)**

Run: `cd ~/projetos/financeiro && npm test`
Expected: PASS — todos os testes verdes.

- [ ] **Step 8: Commit**

```bash
cd ~/projetos/financeiro && git add vitest.config.ts package.json package-lock.json lib/domain/card-fatura-composition.ts lib/domain/card-fatura-composition.test.ts
git commit -m "feat(cards): helper de composição de fatura + setup vitest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Refatorar FaturaGrid para usar o helper

**Files:**
- Modify: `components/cards/fatura-grid.tsx:48`

Objetivo: substituir a expressão inline pela função compartilhada, mantendo comportamento idêntico (uma fonte de verdade).

- [ ] **Step 1: Importar o helper**

Em `components/cards/fatura-grid.tsx`, na lista de imports, após a linha do `@/lib/format`, adicionar:
```ts
import { isLumpFatura } from '@/lib/domain/card-fatura-composition';
```

- [ ] **Step 2: Trocar a expressão inline**

Substituir a linha 48:
```ts
      const isLump = t.category === 'Cartão' && !t.description.includes('(');
```
por:
```ts
      const isLump = isLumpFatura(t);
```

- [ ] **Step 3: Checar tipos**

Run: `cd ~/projetos/financeiro && npx tsc --noEmit`
Expected: sem erros novos relacionados a `fatura-grid.tsx`.

- [ ] **Step 4: Rodar testes (regressão do helper)**

Run: `cd ~/projetos/financeiro && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ~/projetos/financeiro && git add components/cards/fatura-grid.tsx
git commit -m "refactor(fatura-grid): usar isLumpFatura compartilhado

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Componente ExtratoComparativo

**Files:**
- Create: `components/cards/extrato-comparativo.tsx`

Client Component: seleção de até 3 cartões, seletor de mês único, colunas lado a lado com grupos fixos/parcelados/avulsos via `composeFatura`.

- [ ] **Step 1: Criar o componente**

Create `components/cards/extrato-comparativo.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, CreditCard } from 'lucide-react';
import { formatBRL, formatMonthBR, addMonthsToISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import { composeFatura, type FaturaLine } from '@/lib/domain/card-fatura-composition';
import type { CardRow, TransactionRow } from '@/lib/supabase/types';

const MAX_SELECTED = 3;

function currentBillingMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function ExtratoComparativo({
  cards,
  transactions,
}: {
  cards: CardRow[];
  transactions: TransactionRow[];
  year: number;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    cards.slice(0, MAX_SELECTED).map((c) => c.id),
  );
  const [month, setMonth] = useState<string>(() => currentBillingMonth());

  const selectedCards = useMemo(
    () => selectedIds.map((id) => cards.find((c) => c.id === id)).filter((c): c is CardRow => !!c),
    [selectedIds, cards],
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECTED) return prev;
      return [...prev, id];
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 pt-4">
        <div>
          <p className="eyebrow mb-1">Comparar</p>
          <h3 className="headline text-2xl font-medium tracking-tight">Extrato</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonthsToISO(m, -1))}
            className="rounded-md p-1.5 hover:bg-paper-dark/40 text-muted-foreground"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-mono text-sm tabular-nums min-w-[7.5rem] text-center">
            {formatMonthBR(month)}
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonthsToISO(m, 1))}
            className="rounded-md p-1.5 hover:bg-paper-dark/40 text-muted-foreground"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* chips de seleção */}
      <div className="flex flex-wrap gap-2">
        {cards.map((c) => {
          const active = selectedIds.includes(c.id);
          const disabled = !active && selectedIds.length >= MAX_SELECTED;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              disabled={disabled}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                active
                  ? 'border-transparent text-white'
                  : 'border-rule/60 text-muted-foreground hover:border-rule',
                disabled && 'opacity-40 cursor-not-allowed',
              )}
              style={active ? { backgroundColor: c.color ?? '#737373' } : undefined}
            >
              {c.name}
            </button>
          );
        })}
        <span className="self-center text-[10px] italic text-muted-foreground">
          até {MAX_SELECTED} cartões
        </span>
      </div>

      {selectedCards.length === 0 ? (
        <p className="text-sm italic text-muted-foreground py-8 text-center">
          Selecione ao menos um cartão para ver o extrato.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {selectedCards.map((card) => (
            <ExtratoColumn
              key={card.id}
              card={card}
              transactions={transactions}
              month={month}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ExtratoColumn({
  card,
  transactions,
  month,
}: {
  card: CardRow;
  transactions: TransactionRow[];
  month: string;
}) {
  const c = useMemo(
    () => composeFatura(transactions, card.id, month),
    [transactions, card.id, month],
  );
  const limit = Number(card.limit_amount ?? 0);
  const usage = limit > 0 ? (c.total / limit) * 100 : 0;
  const empty = c.total === 0;

  return (
    <div
      className="rounded-lg border border-rule/60 bg-card overflow-hidden"
      style={{ borderTopWidth: '4px', borderTopColor: card.color ?? '#737373' }}
    >
      <div className="px-4 pt-4 pb-3 border-b border-rule/40">
        <p className="eyebrow" style={{ color: card.color ?? undefined }}>
          {card.brand ?? '—'}
        </p>
        <h4 className="font-display text-xl tracking-tight">{card.name}</h4>
        <div className="mt-2 flex items-end justify-between">
          <p className="font-mono text-xl tabular-nums text-money-down">{formatBRL(c.total)}</p>
          {limit > 0 && (
            <p className="text-[10px] italic text-muted-foreground">{usage.toFixed(0)}% do limite</p>
          )}
        </div>
      </div>

      {empty ? (
        <p className="px-4 py-6 text-xs italic text-muted-foreground text-center">
          Sem lançamentos nesta fatura.
        </p>
      ) : (
        <div className="divide-y divide-rule/30">
          <Group
            icon={<Lock className="h-3 w-3" />}
            title="Fixos"
            lines={c.fixed}
            total={c.fixedTotal}
            alwaysShow
          />
          <Group title="Parcelados" lines={c.installments} total={c.installmentsTotal} />
          <Group
            icon={<CreditCard className="h-3 w-3" />}
            title="Avulsos"
            lines={c.oneOff}
            total={c.oneOffTotal}
            footnote={
              c.baseAmount > 0
                ? `+ ${formatBRL(c.baseAmount)} em demais lançamentos do extrato`
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

function Group({
  icon,
  title,
  lines,
  total,
  footnote,
  alwaysShow,
}: {
  icon?: React.ReactNode;
  title: string;
  lines: FaturaLine[];
  total: number;
  footnote?: string;
  alwaysShow?: boolean;
}) {
  if (lines.length === 0 && !footnote && !alwaysShow) return null;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="eyebrow flex items-center gap-1">
          {icon}
          {title}
        </p>
        <p className="font-mono text-xs tabular-nums text-foreground/70">{formatBRL(total)}</p>
      </div>
      <ul className="space-y-1">
        {lines.map(({ tx, installmentLabel }) => (
          <li key={tx.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-foreground/80">
              {tx.description}
              {installmentLabel && (
                <span className="ml-1 rounded bg-paper-dark/60 px-1 text-[10px] tabular-nums text-muted-foreground">
                  {installmentLabel}
                </span>
              )}
            </span>
            <span className="font-mono tabular-nums shrink-0">
              {formatBRL(Math.abs(Number(tx.amount)))}
            </span>
          </li>
        ))}
        {lines.length === 0 && alwaysShow && (
          <li className="text-[11px] italic text-muted-foreground">nenhum gasto fixo</li>
        )}
      </ul>
      {footnote && <p className="mt-1.5 text-[10px] italic text-muted-foreground">{footnote}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `cd ~/projetos/financeiro && npx tsc --noEmit`
Expected: sem erros em `extrato-comparativo.tsx`.

- [ ] **Step 3: Commit**

```bash
cd ~/projetos/financeiro && git add components/cards/extrato-comparativo.tsx
git commit -m "feat(cards): componente de extrato comparativo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Integrar na tela de Cartões

**Files:**
- Modify: `app/(app)/cards/_view.tsx`

Inserir a seção entre o `FaturaGrid` e o bloco "Por cartão".

- [ ] **Step 1: Importar o componente**

Em `app/(app)/cards/_view.tsx`, após a linha:
```tsx
import { FaturaGrid } from '@/components/cards/fatura-grid';
```
adicionar:
```tsx
import { ExtratoComparativo } from '@/components/cards/extrato-comparativo';
```

- [ ] **Step 2: Renderizar a seção**

Localizar o bloco (atualmente por volta da linha 140-146):
```tsx
        <FaturaGrid
          userId={userId}
          cards={initialCards}
          transactions={transactions}
          year={year}
        />

        <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 pt-4">
          <div>
            <p className="eyebrow mb-1">Detalhe</p>
```
Inserir o `ExtratoComparativo` logo após o fechamento do `FaturaGrid` e antes do `<div ...>Detalhe`:
```tsx
        <FaturaGrid
          userId={userId}
          cards={initialCards}
          transactions={transactions}
          year={year}
        />

        <ExtratoComparativo cards={initialCards} transactions={transactions} year={year} />

        <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 pt-4">
          <div>
            <p className="eyebrow mb-1">Detalhe</p>
```

- [ ] **Step 3: Checar tipos**

Run: `cd ~/projetos/financeiro && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Lint**

Run: `cd ~/projetos/financeiro && npm run lint`
Expected: sem novos erros nos arquivos tocados.

- [ ] **Step 5: Verificação manual**

Run: `cd ~/projetos/financeiro && npm run dev`
Abrir `/cards`. Verificar:
- A seção "Extrato" aparece abaixo do grid de faturas.
- Vêm até 3 cartões pré-selecionados; clicar nos chips adiciona/remove (trava em 3).
- Setas de mês mudam o mês exibido em todas as colunas.
- Cada coluna mostra Fixos (sempre visível) / Parcelados / Avulsos com subtotais e total batendo com a fatura do mês.
- Parcelados exibem a etiqueta `n/total`.

- [ ] **Step 6: Commit**

```bash
cd ~/projetos/financeiro && git add app/\(app\)/cards/_view.tsx
git commit -m "feat(cards): integrar extrato comparativo na tela de cartões

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (preenchido pelo autor do plano)

- **Cobertura do spec:** classificação exclusiva (Task 1), linha base em avulsos (Task 1/3), fonte única de verdade via helper (Task 1/2), seção comparativa com ≤3 cartões + mês único + grupos com subtotais (Task 3), integração sem nova query (Task 4), casos de borda (sem cartão / mês vazio / sem limite) cobertos no componente e nos testes. ✔
- **Placeholders:** nenhum — todo passo tem código/comando concreto. ✔
- **Consistência de tipos:** `FaturaComposition`/`FaturaLine` definidos na Task 1 e usados igual nas Tasks 3; `composeFatura(transactions, cardId, billingMonth)` e `isLumpFatura(t)` com assinaturas estáveis. ✔
