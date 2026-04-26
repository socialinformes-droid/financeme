'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBRL, formatMonthBR, addMonthsToISO } from '@/lib/format';
import { CATEGORY_COLOR } from '@/lib/domain/categories';

export type PivotRow = {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  expense_month: string | null;
  billing_month: string | null;
};

type PivotProps = {
  data: PivotRow[];
  /** Eixo do mês: gasto (quando aconteceu) ou fatura (quando sai do bolso) */
  monthAxis?: 'expense' | 'billing';
  /** Mês de partida (string ISO YYYY-MM-01). Default: jan/2026 */
  startMonth?: string;
  monthsCount?: number;
};

export function PivotTable({
  data,
  monthAxis: initialAxis = 'expense',
  startMonth = '2026-01-01',
  monthsCount = 12,
}: PivotProps) {
  const [monthAxis, setMonthAxis] = useState<'expense' | 'billing'>(initialAxis);

  const months = useMemo(
    () =>
      Array.from({ length: monthsCount }, (_, i) => addMonthsToISO(startMonth, i)),
    [startMonth, monthsCount],
  );

  // Agrupa: type → category → month → soma
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, Map<string, number>>>();
    let outOfRange = 0;
    for (const row of data) {
      const m = monthAxis === 'expense' ? row.expense_month : row.billing_month;
      if (!m) continue;
      if (!months.includes(m)) {
        outOfRange += row.amount;
        continue;
      }
      const tBucket = map.get(row.type) ?? new Map();
      map.set(row.type, tBucket);
      const cBucket = tBucket.get(row.category) ?? new Map();
      tBucket.set(row.category, cBucket);
      cBucket.set(m, (cBucket.get(m) ?? 0) + row.amount);
    }
    return { map, outOfRange };
  }, [data, monthAxis, months]);

  const expenseSection = buildSection(grouped.map.get('expense'), months);
  const incomeSection = buildSection(grouped.map.get('income'), months);

  const totalsByMonth = months.map((m) => {
    const expSum = expenseSection.totalsByMonth.get(m) ?? 0;
    const incSum = incomeSection.totalsByMonth.get(m) ?? 0;
    return expSum + incSum;
  });
  const totalGeral = totalsByMonth.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-md border bg-card">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b">
        <div>
          <h3 className="text-sm font-medium">Visão mensal por categoria</h3>
          <p className="text-xs text-muted-foreground">
            {monthAxis === 'expense' ? 'Mês do gasto' : 'Mês da fatura/débito'}
            {' · '}
            {formatMonthBR(months[0])} → {formatMonthBR(months[months.length - 1])}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs">
          <button
            onClick={() => setMonthAxis('expense')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-colors',
              monthAxis === 'expense'
                ? 'bg-background text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Mês gasto
          </button>
          <button
            onClick={() => setMonthAxis('billing')}
            className={cn(
              'px-2.5 py-1 rounded-md transition-colors',
              monthAxis === 'billing'
                ? 'bg-background text-foreground shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Mês fatura
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead className="bg-muted/50">
            <tr className="text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2 text-left font-medium w-32">
                Fluxo
              </th>
              <th className="sticky left-32 z-10 bg-muted/50 px-3 py-2 text-left font-medium w-32">
                Categoria
              </th>
              {months.map((m) => (
                <th key={m} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                  {formatMonthBR(m)}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium whitespace-nowrap bg-muted/70">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {/* SAÍDAS */}
            {expenseSection.rows.length > 0 && (
              <Section
                label="⬆ Saídas"
                color="red"
                rows={expenseSection.rows}
                totalsByMonth={expenseSection.totalsByMonth}
                grandTotal={expenseSection.grandTotal}
                months={months}
              />
            )}

            {/* ENTRADAS */}
            {incomeSection.rows.length > 0 && (
              <Section
                label="⬇ Entradas"
                color="green"
                rows={incomeSection.rows}
                totalsByMonth={incomeSection.totalsByMonth}
                grandTotal={incomeSection.grandTotal}
                months={months}
              />
            )}

            {/* TOTAL GERAL */}
            <tr className="border-t-2 border-foreground/20 bg-muted/30 font-semibold">
              <td colSpan={2} className="sticky left-0 bg-muted/60 px-3 py-2.5">
                Total geral
              </td>
              {totalsByMonth.map((v, i) => (
                <td
                  key={months[i]}
                  className={cn(
                    'px-2 py-2.5 text-right tabular-nums',
                    v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-muted-foreground',
                  )}
                >
                  {v === 0 ? '—' : formatNumber(v)}
                </td>
              ))}
              <td
                className={cn(
                  'px-3 py-2.5 text-right tabular-nums bg-muted/80',
                  totalGeral > 0 ? 'text-green-400' : totalGeral < 0 ? 'text-red-400' : '',
                )}
              >
                {formatNumber(totalGeral)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {grouped.outOfRange !== 0 && (
        <p className="px-4 py-2 text-[11px] text-muted-foreground border-t">
          {formatBRL(grouped.outOfRange)} fora da janela ({formatMonthBR(months[0])} → {formatMonthBR(months[months.length - 1])})
        </p>
      )}
    </div>
  );
}

type SectionData = {
  rows: { category: string; byMonth: Map<string, number>; total: number }[];
  totalsByMonth: Map<string, number>;
  grandTotal: number;
};

function buildSection(
  bucket: Map<string, Map<string, number>> | undefined,
  months: string[],
): SectionData {
  if (!bucket) return { rows: [], totalsByMonth: new Map(), grandTotal: 0 };

  const rows = [...bucket.entries()]
    .map(([category, byMonth]) => {
      const total = [...byMonth.values()].reduce((a, b) => a + b, 0);
      return { category, byMonth, total };
    })
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const totalsByMonth = new Map<string, number>();
  for (const m of months) {
    const sum = rows.reduce((acc, r) => acc + (r.byMonth.get(m) ?? 0), 0);
    totalsByMonth.set(m, sum);
  }
  const grandTotal = rows.reduce((acc, r) => acc + r.total, 0);
  return { rows, totalsByMonth, grandTotal };
}

function Section({
  label,
  color,
  rows,
  totalsByMonth,
  grandTotal,
  months,
}: {
  label: string;
  color: 'red' | 'green';
  rows: SectionData['rows'];
  totalsByMonth: SectionData['totalsByMonth'];
  grandTotal: number;
  months: string[];
}) {
  const [open, setOpen] = useState(true);
  const colorClass = color === 'red' ? 'text-red-400' : 'text-green-400';
  return (
    <>
      <tr className="bg-muted/20 hover:bg-muted/30 cursor-pointer" onClick={() => setOpen(!open)}>
        <td colSpan={2} className="sticky left-0 bg-muted/40 px-3 py-2 font-medium">
          <div className="flex items-center gap-1.5">
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span className={colorClass}>{label}</span>
          </div>
        </td>
        {months.map((m) => {
          const v = totalsByMonth.get(m) ?? 0;
          return (
            <td
              key={m}
              className={cn(
                'px-2 py-2 text-right tabular-nums font-medium',
                v === 0 ? 'text-muted-foreground' : colorClass,
              )}
            >
              {v === 0 ? '—' : formatNumber(v)}
            </td>
          );
        })}
        <td className={cn('px-3 py-2 text-right tabular-nums font-semibold bg-muted/40', colorClass)}>
          {formatNumber(grandTotal)}
        </td>
      </tr>

      {open &&
        rows.map((row) => (
          <tr key={`${label}-${row.category}`} className="hover:bg-muted/20">
            <td className="sticky left-0 bg-card px-3 py-1.5"></td>
            <td className="sticky left-32 bg-card px-3 py-1.5">
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{
                    background:
                      CATEGORY_COLOR[row.category as keyof typeof CATEGORY_COLOR] ?? '#737373',
                  }}
                />
                {row.category}
              </span>
            </td>
            {months.map((m) => {
              const v = row.byMonth.get(m) ?? 0;
              return (
                <td
                  key={m}
                  className={cn(
                    'px-2 py-1.5 text-right tabular-nums',
                    v === 0
                      ? 'text-muted-foreground/60'
                      : v < 0
                        ? 'text-red-400/90'
                        : 'text-green-400/90',
                  )}
                >
                  {v === 0 ? '—' : formatNumber(v)}
                </td>
              );
            })}
            <td className={cn('px-3 py-1.5 text-right tabular-nums bg-muted/30 font-medium', colorClass)}>
              {formatNumber(row.total)}
            </td>
          </tr>
        ))}
    </>
  );
}

function formatNumber(v: number): string {
  if (v === 0) return '—';
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return v < 0 ? `(${formatted})` : formatted;
}
