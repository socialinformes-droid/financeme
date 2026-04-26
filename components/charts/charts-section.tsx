'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IncomeVsExpenseChart, type MonthlySummary } from './income-vs-expense-chart';
import { CategoryPieChart, type CategorySlice } from './category-pie-chart';
import { formatBRL, formatMonthBR } from '@/lib/format';
import { cn } from '@/lib/utils';

type Period = '1m' | '3m' | '6m' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  '1m': 'Mês',
  '3m': '3 meses',
  '6m': '6 meses',
  year: 'Ano',
  all: 'Tudo',
};

export type ChartTransaction = {
  type: 'income' | 'expense';
  category: string;
  amount: number;
  expense_month: string | null;
};

export function ChartsSection({
  transactions,
  yearStart,
  todayKey,
}: {
  transactions: ChartTransaction[];
  yearStart: string;
  todayKey: string;
}) {
  const [period, setPeriod] = useState<Period>('year');

  const months = useMemo(() => {
    if (period === 'all') {
      const set = new Set<string>();
      for (const t of transactions) if (t.expense_month) set.add(t.expense_month);
      return [...set].sort();
    }
    const todayDate = new Date(`${todayKey}T00:00:00`);
    const todayYear = todayDate.getFullYear();
    const todayMonth = todayDate.getMonth(); // 0-11
    if (period === '1m') return [todayKey];
    if (period === 'year') {
      return Array.from({ length: 12 }, (_, i) => `${yearStart.slice(0, 4)}-${String(i + 1).padStart(2, '0')}-01`);
    }
    const count = period === '3m' ? 3 : 6;
    const list: string[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const totalMonths = todayYear * 12 + todayMonth - i;
      const y = Math.floor(totalMonths / 12);
      const m = (totalMonths % 12) + 1;
      list.push(`${y}-${String(m).padStart(2, '0')}-01`);
    }
    return list;
  }, [period, todayKey, yearStart, transactions]);

  const monthlyData: MonthlySummary[] = useMemo(() => {
    return months.map((m) => {
      const sub = transactions.filter((t) => t.expense_month === m);
      const inc = sub.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0);
      const exp = sub.filter((t) => t.type === 'expense').reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
      return { month: m, label: formatMonthBR(m), income: inc, expense: exp };
    });
  }, [months, transactions]);

  const slices: CategorySlice[] = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (!t.expense_month) continue;
      if (!months.includes(t.expense_month)) continue;
      if (t.type !== 'expense') continue;
      map.set(t.category, (map.get(t.category) ?? 0) + Math.abs(Number(t.amount)));
    }
    return [...map.entries()]
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, months]);

  const totals = useMemo(() => {
    const income = monthlyData.reduce((a, m) => a + m.income, 0);
    const expense = monthlyData.reduce((a, m) => a + m.expense, 0);
    return { income, expense, balance: income - expense };
  }, [monthlyData]);

  const periodSubtitle =
    months.length === 0
      ? 'sem dados'
      : months.length === 1
        ? formatMonthBR(months[0])
        : `${formatMonthBR(months[0])} → ${formatMonthBR(months[months.length - 1])}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">Gráficos</h3>
          <p className="text-xs text-muted-foreground">
            {periodSubtitle} · entradas {formatBRL(totals.income)} · saídas {formatBRL(totals.expense)}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-0.5 text-xs self-start">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'px-2.5 py-1 rounded-md transition-colors',
                period === p
                  ? 'bg-background text-foreground shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Entradas vs Saídas — {periodSubtitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <IncomeVsExpenseChart data={monthlyData} />
            ) : (
              <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                Sem dados no período
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Categorias — {periodSubtitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={slices} />
            {slices.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-xs max-h-32 overflow-y-auto">
                {slices.slice(0, 6).map((s) => (
                  <li key={s.category} className="flex justify-between">
                    <span className="text-muted-foreground">{s.category}</span>
                    <span className="font-medium">{formatBRL(s.value)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
