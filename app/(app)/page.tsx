import { createClient } from '@/lib/supabase/server';
import {
  firstDayOfMonth,
  formatBRL,
  formatDateBR,
  formatMonthBR,
  toISODate,
} from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartsSection, type ChartTransaction } from '@/components/charts/charts-section';
import { PivotTable, type PivotRow } from '@/components/pivot-table';
import type { TransactionRow, ShoppingItemRow } from '@/lib/supabase/types';
import { ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const supabase = await createClient();

  const today = new Date();
  const year = today.getFullYear();
  const startOfYear = `${year}-01-01`;
  const currentMonthKey = toISODate(firstDayOfMonth(today));

  const { data: allTxs, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: true });

  if (txError) console.error('[dashboard tx]', txError);
  const txs = (allTxs ?? []) as TransactionRow[];

  // Cards do mês atual
  let monthIncome = 0;
  let monthExpense = 0;
  for (const t of txs) {
    if (t.expense_month !== currentMonthKey) continue;
    if (t.type === 'income') monthIncome += Number(t.amount);
    else monthExpense += Math.abs(Number(t.amount));
  }
  const monthBalance = monthIncome - monthExpense;

  // Acumulado do ano
  let yearBalance = 0;
  for (const t of txs) {
    if (!t.expense_month) continue;
    if (t.expense_month < startOfYear) continue;
    if (t.expense_month >= `${year + 1}-01-01`) continue;
    yearBalance += Number(t.amount);
  }

  const chartTxs: ChartTransaction[] = txs.map((t) => ({
    type: t.type,
    category: t.category,
    amount: Number(t.amount),
    expense_month: t.expense_month,
  }));

  const pivotRows: PivotRow[] = txs.map((t) => ({
    type: t.type,
    category: t.category,
    amount: Number(t.amount),
    expense_month: t.expense_month,
    billing_month: t.billing_month,
  }));

  const upcomingInstallments = txs
    .filter((t) => t.is_installment && t.billing_month === currentMonthKey && !t.is_paid)
    .slice(0, 6);

  const { data: shoppingTop } = await supabase
    .from('shopping_list')
    .select('*')
    .eq('is_purchased', false)
    .eq('priority', 'high')
    .order('created_at', { ascending: false })
    .limit(3);

  return (
    <div className="space-y-10">
      {/* Cabeçalho editorial */}
      <header className="space-y-2 pb-6 border-b border-rule/60">
        <p className="eyebrow">Volume {year} · Edição mensal</p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h2 className="headline text-5xl md:text-6xl font-light tracking-tight leading-none">
            <span className="italic font-extralight text-foreground/70">de</span>{' '}
            {formatMonthBR(currentMonthKey).replace('/', ' de 20')}
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            {today.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
          </p>
        </div>
      </header>

      {/* Manchetes do mês */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-rule/60 border border-rule/60 rounded-lg overflow-hidden">
        <SummaryCard label="Entradas" value={monthIncome} accent="green" />
        <SummaryCard label="Saídas" value={-monthExpense} accent="red" />
        <SummaryCard
          label="Saldo do mês"
          value={monthBalance}
          accent={monthBalance >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          label={`Acumulado ${year}`}
          value={yearBalance}
          accent={yearBalance >= 0 ? 'green' : 'red'}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Caderno principal"
          title="Visão por categoria"
          subtitle="Linhas mensais cruzadas com o motivo do lançamento"
        />
        <PivotTable data={pivotRows} startMonth={`${year}-01-01`} monthsCount={12} />
      </section>

      <section className="space-y-3">
        <SectionHeader
          eyebrow="Suplemento"
          title="Em gráficos"
          subtitle="Mesma história, contada de outro jeito"
        />
        <ChartsSection
          transactions={chartTxs}
          yearStart={startOfYear}
          todayKey={currentMonthKey}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article>
          <SectionHeader eyebrow="Agenda" title="Parcelas do mês" />
          <Card className="rounded-md border-rule/70 shadow-none">
            <CardContent className="pt-5">
              {upcomingInstallments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nada em aberto este mês.
                </p>
              ) : (
                <ul className="divide-y divide-rule/40">
                  {upcomingInstallments.map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div>
                        <p className="font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          parcela {t.installment_number}/{t.total_installments} ·{' '}
                          {formatDateBR(t.transaction_date)}
                        </p>
                      </div>
                      <span className="font-mono tabular-nums text-money-down">
                        {formatBRL(t.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </article>

        <article>
          <SectionHeader eyebrow="Classificados" title="Pra comprar" subtitle="Alta prioridade" />
          <Card className="rounded-md border-rule/70 shadow-none">
            <CardContent className="pt-5">
              {(shoppingTop ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Sem itens prioritários no momento.
                </p>
              ) : (
                <ul className="divide-y divide-rule/40">
                  {(shoppingTop as ShoppingItemRow[]).map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground italic">
                          {s.store_name ?? '—'} · {s.category ?? '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono tabular-nums text-xs text-foreground/80">
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
        </article>
      </section>

      <footer className="text-center pt-4 pb-2">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50">
          ❦ Fim da edição ❦
        </p>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
      <div>
        <p className="eyebrow mb-1">{eyebrow}</p>
        <h3 className="headline text-2xl font-medium tracking-tight">{title}</h3>
      </div>
      {subtitle && (
        <p className="text-xs italic text-muted-foreground pb-1">{subtitle}</p>
      )}
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
      ? 'text-money-up'
      : accent === 'red'
        ? 'text-money-down'
        : 'text-foreground';
  return (
    <div className="bg-card px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 font-mono text-2xl tabular-nums ${colorClass}`}>{formatBRL(value)}</p>
    </div>
  );
}
