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
