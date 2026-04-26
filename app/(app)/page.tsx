import { createClient } from '@/lib/supabase/server';
import {
  addMonths,
  firstDayOfMonth,
  formatBRL,
  formatDateBR,
  formatMonthBR,
  toISODate,
} from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IncomeVsExpenseChart, type MonthlySummary } from '@/components/charts/income-vs-expense-chart';
import { CategoryPieChart, type CategorySlice } from '@/components/charts/category-pie-chart';
import { PivotTable, type PivotRow } from '@/components/pivot-table';
import type { TransactionRow, ShoppingItemRow } from '@/lib/supabase/types';
import { ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();

  // Janela: o ano atual inteiro (jan → dez do ano corrente).
  // O dataset 2026 cobre jan/26 a dez/26 + 1 row em jan/27.
  const today = new Date();
  const year = today.getFullYear();
  const startOfYear = `${year}-01-01`;

  const { data: allTxs, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: true });

  if (txError) console.error('[dashboard tx]', txError);
  const txs = (allTxs ?? []) as TransactionRow[];

  // -------- Cards do mês atual (a partir de transactions com expense_month = mês atual) --------
  const currentMonthKey = toISODate(firstDayOfMonth(today));
  let monthIncome = 0;
  let monthExpense = 0;
  for (const t of txs) {
    if (t.expense_month !== currentMonthKey) continue;
    if (t.type === 'income') monthIncome += Number(t.amount);
    else monthExpense += Math.abs(Number(t.amount));
  }
  const monthBalance = monthIncome - monthExpense;

  // Acumulado do ano (todas as transações dentro do ano corrente)
  let yearBalance = 0;
  for (const t of txs) {
    if (!t.expense_month) continue;
    if (t.expense_month < startOfYear) continue;
    if (t.expense_month >= `${year + 1}-01-01`) continue;
    yearBalance += Number(t.amount);
  }

  // -------- BarChart 12 meses (jan → dez do ano corrente) --------
  const monthly: MonthlySummary[] = [];
  for (let i = 0; i < 12; i++) {
    const m = `${year}-${String(i + 1).padStart(2, '0')}-01`;
    const sub = txs.filter((t) => t.expense_month === m);
    const inc = sub.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0);
    const exp = sub.filter((t) => t.type === 'expense').reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
    monthly.push({ month: m, label: formatMonthBR(m), income: inc, expense: exp });
  }

  // -------- PieChart do mês atual --------
  const sliceMap = new Map<string, number>();
  for (const t of txs) {
    if (t.expense_month !== currentMonthKey) continue;
    if (t.type !== 'expense') continue;
    sliceMap.set(t.category, (sliceMap.get(t.category) ?? 0) + Math.abs(Number(t.amount)));
  }
  const slices: CategorySlice[] = [...sliceMap.entries()]
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);

  // -------- Pivot table (todas as 137 transações do ano) --------
  const pivotRows: PivotRow[] = txs.map((t) => ({
    type: t.type,
    category: t.category,
    amount: Number(t.amount),
    expense_month: t.expense_month,
    billing_month: t.billing_month,
  }));

  // -------- Próximas parcelas (mês atual, não pagas) --------
  const upcomingInstallments = txs
    .filter((t) => t.is_installment && t.billing_month === currentMonthKey && !t.is_paid)
    .slice(0, 6);

  // -------- Top 3 lista de compras --------
  const { data: shoppingTop } = await supabase
    .from('shopping_list')
    .select('*')
    .eq('is_purchased', false)
    .eq('priority', 'high')
    .order('created_at', { ascending: false })
    .limit(3);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {formatMonthBR(currentMonthKey)} · {year}
          </p>
        </div>
      </header>

      {/* Cards de resumo */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label={`Entradas — ${formatMonthBR(currentMonthKey)}`} value={monthIncome} accent="green" />
        <SummaryCard label={`Saídas — ${formatMonthBR(currentMonthKey)}`} value={-monthExpense} accent="red" />
        <SummaryCard
          label={`Saldo do mês`}
          value={monthBalance}
          accent={monthBalance >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          label={`Acumulado ${year}`}
          value={yearBalance}
          accent={yearBalance >= 0 ? 'green' : 'red'}
        />
      </section>

      {/* Tabela dinâmica — visualização principal */}
      <section>
        <PivotTable data={pivotRows} startMonth={`${year}-01-01`} monthsCount={12} />
      </section>

      {/* Gráficos auxiliares */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Entradas vs Saídas — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeVsExpenseChart data={monthly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Categorias — {formatMonthBR(currentMonthKey)}
            </CardTitle>
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
      </section>

      {/* Próximas parcelas + lista compras */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parcelas do mês</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingInstallments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma parcela aberta</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {upcomingInstallments.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.installment_number}/{t.total_installments} ·{' '}
                        {formatDateBR(t.transaction_date)}
                      </p>
                    </div>
                    <span className="font-mono text-red-400">{formatBRL(t.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lista de compras — alta prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            {(shoppingTop ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem itens prioritários</p>
            ) : (
              <ul className="space-y-2">
                {(shoppingTop as ShoppingItemRow[]).map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.store_name ?? '—'} · {s.category ?? '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs">
                        {formatBRL(s.price_min ?? 0)}–{formatBRL(s.price_max ?? 0)}
                      </span>
                      {s.reference_url && (
                        <a
                          href={s.reference_url}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 inline-flex"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'green' | 'red' | 'muted';
}) {
  const colorClass =
    accent === 'green'
      ? 'text-green-400'
      : accent === 'red'
        ? 'text-red-400'
        : 'text-foreground';
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 font-mono text-xl font-semibold ${colorClass}`}>{formatBRL(value)}</p>
      </CardContent>
    </Card>
  );
}
