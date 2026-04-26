import { createClient } from '@/lib/supabase/server';
import { addMonths, firstDayOfMonth, formatBRL, formatDateBR, formatMonthBR, toISODate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IncomeVsExpenseChart, type MonthlySummary } from '@/components/charts/income-vs-expense-chart';
import { CategoryPieChart, type CategorySlice } from '@/components/charts/category-pie-chart';
import type { TransactionRow, ShoppingItemRow } from '@/lib/supabase/types';
import { ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();

  const today = new Date();
  const currentMonthStart = firstDayOfMonth(today);
  const startWindow = addMonths(currentMonthStart, -11);
  const endWindow = addMonths(currentMonthStart, 1);

  const { data: txs12m, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .gte('expense_month', toISODate(startWindow))
    .lt('expense_month', toISODate(endWindow));

  if (txError) console.error('[dashboard tx]', txError);

  const txs = (txs12m ?? []) as TransactionRow[];

  // Agrupa 12 meses
  const monthly: Record<string, MonthlySummary> = {};
  for (let i = 0; i < 12; i++) {
    const m = addMonths(startWindow, i);
    const key = toISODate(m);
    monthly[key] = { month: key, label: formatMonthBR(m), income: 0, expense: 0 };
  }
  for (const t of txs) {
    if (!t.expense_month) continue;
    const key = t.expense_month;
    if (!monthly[key]) continue;
    if (t.type === 'income') monthly[key].income += Number(t.amount);
    else monthly[key].expense += Math.abs(Number(t.amount));
  }
  const monthlyArr = Object.values(monthly);

  // Mês atual
  const currentKey = toISODate(currentMonthStart);
  const currentMonth = monthly[currentKey] ?? {
    month: currentKey,
    label: formatMonthBR(currentMonthStart),
    income: 0,
    expense: 0,
  };
  const balance = currentMonth.income - currentMonth.expense;

  // Saldo acumulado dos 12 meses no histórico
  const accumulated = monthlyArr.reduce((acc, m) => acc + (m.income - m.expense), 0);

  // Pie do mês atual por categoria (apenas saídas)
  const sliceMap = new Map<string, number>();
  for (const t of txs) {
    if (t.expense_month !== currentKey) continue;
    if (t.type !== 'expense') continue;
    sliceMap.set(t.category, (sliceMap.get(t.category) ?? 0) + Math.abs(Number(t.amount)));
  }
  const slices: CategorySlice[] = [...sliceMap.entries()]
    .map(([category, value]) => ({ category, value }))
    .sort((a, b) => b.value - a.value);

  // Próximas parcelas (mês atual)
  const upcomingInstallments = txs
    .filter(
      (t) =>
        t.is_installment &&
        t.billing_month === currentKey &&
        !t.is_paid,
    )
    .sort((a, b) => (a.transaction_date < b.transaction_date ? -1 : 1))
    .slice(0, 6);

  // Top 3 lista de compras alta prioridade
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
          <p className="text-sm text-muted-foreground">{formatMonthBR(currentMonthStart)}</p>
        </div>
      </header>

      {/* Cards de resumo */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Entradas" value={currentMonth.income} accent="green" />
        <SummaryCard label="Saídas" value={-currentMonth.expense} accent="red" />
        <SummaryCard label="Saldo do mês" value={balance} accent={balance >= 0 ? 'green' : 'red'} />
        <SummaryCard label="Acumulado 12m" value={accumulated} accent="muted" />
      </section>

      {/* Gráficos */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Entradas vs Saídas — 12 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeVsExpenseChart data={monthlyArr} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por categoria — {formatMonthBR(currentMonthStart)}</CardTitle>
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
            <CardTitle className="text-base">Lista de compras — prioridade alta</CardTitle>
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
