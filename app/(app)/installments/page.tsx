import { createClient } from '@/lib/supabase/server';
import {
  formatBRL,
  formatMonthBR,
  toISODate,
  firstDayOfMonth,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { resolveYear } from '@/lib/domain/years';
import type { TransactionRow } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Group = {
  groupId: string;
  description: string;
  category: string;
  payment_method: string;
  total: number;
  paidAmount: number;
  totalParts: number;
  paidParts: number;
  startMonth: string;
  endMonth: string;
  rows: TransactionRow[];
  status: 'active' | 'finished' | 'upcoming';
};

export default async function InstallmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const supabase = await createClient();
  const { year: yearParam } = await searchParams;
  const year = resolveYear(yearParam);
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year + 1}-01-01`;

  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('is_installment', true)
    .order('billing_month', { ascending: true });

  // Filtra grupos cujo período (start..end) intersecta com o ano selecionado
  const allTxs = (data ?? []) as TransactionRow[];
  const groupsActiveInYear = new Set<string>();
  const groupBounds = new Map<string, { start: string; end: string }>();
  for (const t of allTxs) {
    if (!t.installment_group_id || !t.billing_month) continue;
    const cur = groupBounds.get(t.installment_group_id);
    if (!cur) {
      groupBounds.set(t.installment_group_id, { start: t.billing_month, end: t.billing_month });
    } else {
      if (t.billing_month < cur.start) cur.start = t.billing_month;
      if (t.billing_month > cur.end) cur.end = t.billing_month;
    }
  }
  for (const [gid, { start, end }] of groupBounds) {
    if (start < endOfYear && end >= startOfYear) groupsActiveInYear.add(gid);
  }
  const txs = allTxs.filter(
    (t) => t.installment_group_id && groupsActiveInYear.has(t.installment_group_id),
  );

  // Agrupar por installment_group_id
  const map = new Map<string, TransactionRow[]>();
  for (const t of txs) {
    if (!t.installment_group_id) continue;
    const arr = map.get(t.installment_group_id) ?? [];
    arr.push(t);
    map.set(t.installment_group_id, arr);
  }

  const todayKey = toISODate(firstDayOfMonth(new Date()));

  const groups: Group[] = [...map.entries()]
    .map(([groupId, rows]) => {
      const sorted = [...rows].sort(
        (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0),
      );
      const total = sorted.reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
      const paid = sorted.filter((t) => t.is_paid);
      const startMonth = sorted[0]?.billing_month ?? '';
      const endMonth = sorted[sorted.length - 1]?.billing_month ?? '';
      let status: Group['status'] = 'active';
      if (endMonth && endMonth < todayKey) status = 'finished';
      else if (startMonth && startMonth > todayKey) status = 'upcoming';
      return {
        groupId,
        description: sorted[0]?.description.replace(/\s*\(\d+\/\d+\)\s*$/, '') ?? '',
        category: sorted[0]?.category ?? '',
        payment_method: sorted[0]?.payment_method ?? '',
        total,
        paidAmount: paid.reduce((a, t) => a + Math.abs(Number(t.amount)), 0),
        totalParts: sorted.length,
        paidParts: paid.length,
        startMonth,
        endMonth,
        rows: sorted,
        status,
      };
    })
    .sort((a, b) => {
      // Ativas primeiro, depois upcoming, depois finalizadas
      const order = { active: 0, upcoming: 1, finished: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.endMonth.localeCompare(b.endMonth);
    });

  // Calendário: meses com parcelas terminando
  const endingByMonth = new Map<string, Group[]>();
  for (const g of groups) {
    if (g.status === 'finished') continue;
    const arr = endingByMonth.get(g.endMonth) ?? [];
    arr.push(g);
    endingByMonth.set(g.endMonth, arr);
  }
  const sortedEndingMonths = [...endingByMonth.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const totalActive = groups
    .filter((g) => g.status !== 'finished')
    .reduce((a, g) => a + (g.total - g.paidAmount), 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-4 border-b border-rule/60">
        <div>
          <p className="eyebrow">Caderno de</p>
          <h2 className="headline text-4xl font-light tracking-tight">Parcelas</h2>
          <p className="text-xs italic text-muted-foreground mt-1.5">
            <span className="font-mono not-italic mr-1">{year}</span> · {groups.length}{' '}
            {groups.length === 1 ? 'grupo ativo' : 'grupos ativos'} · ainda devo{' '}
            <span className="font-mono not-italic text-money-down">{formatBRL(totalActive)}</span>
          </p>
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="text-center text-sm italic text-muted-foreground py-12">
          Nenhuma parcela em aberto.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <p className="eyebrow">Em andamento</p>
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groups
                .filter((g) => g.status !== 'finished')
                .map((g) => (
                  <InstallmentGroupCard key={g.groupId} group={g} todayKey={todayKey} />
                ))}
            </ul>
          </section>

          {sortedEndingMonths.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
                <div>
                  <p className="eyebrow mb-1">Calendário</p>
                  <h3 className="headline text-2xl font-medium tracking-tight">Encerramentos</h3>
                </div>
                <p className="text-xs italic text-muted-foreground pb-1">
                  Quando cada grupo termina
                </p>
              </div>
              <ul className="divide-y divide-rule/40 border border-rule/60 rounded-md bg-card">
                {sortedEndingMonths.map(([month, gs]) => (
                  <li key={month} className="flex items-center gap-4 px-5 py-3">
                    <span className="font-display italic text-base w-20 shrink-0">
                      {formatMonthBR(month)}
                    </span>
                    <ul className="flex-1 flex flex-wrap gap-2">
                      {gs.map((g) => (
                        <li
                          key={g.groupId}
                          className="text-xs px-2.5 py-1 rounded-full bg-paper-dark/50 border border-rule/50"
                        >
                          {g.description}
                        </li>
                      ))}
                    </ul>
                    <span className="text-xs text-muted-foreground italic">
                      {gs.length} {gs.length === 1 ? 'grupo' : 'grupos'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups.some((g) => g.status === 'finished') && (
            <section className="space-y-3">
              <p className="eyebrow">Encerradas</p>
              <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {groups
                  .filter((g) => g.status === 'finished')
                  .map((g) => (
                    <InstallmentGroupCard key={g.groupId} group={g} todayKey={todayKey} />
                  ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function InstallmentGroupCard({
  group,
  todayKey,
}: {
  group: Group;
  todayKey: string;
}) {
  const remaining = group.total - group.paidAmount;
  const progress = (group.paidParts / group.totalParts) * 100;
  const isFinished = group.status === 'finished';

  return (
    <Card
      className={cn(
        'rounded-lg border-rule/60 shadow-none transition-all',
        isFinished && 'opacity-70',
      )}
    >
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="eyebrow mb-0.5">{group.category}</p>
            <h4 className="font-medium text-base">{group.description}</h4>
            <p className="text-[11px] italic text-muted-foreground capitalize">
              {group.payment_method} · {formatMonthBR(group.startMonth)} → {formatMonthBR(group.endMonth)}
            </p>
          </div>
          <div className="text-right">
            <p className="eyebrow">Total</p>
            <p className="font-mono text-base tabular-nums">{formatBRL(group.total)}</p>
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="space-y-1.5">
          <div className="h-1 rounded-full bg-paper-dark/60 overflow-hidden">
            <div
              className="h-full bg-money-down/80 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>
              {group.paidParts}/{group.totalParts} pagas
            </span>
            {!isFinished && (
              <span className="font-mono tabular-nums text-money-down/80">
                resta {formatBRL(remaining)}
              </span>
            )}
          </div>
        </div>

        {/* Trilha mensal */}
        <div className="mt-4 pt-3 border-t border-rule/30">
          <p className="eyebrow mb-2">Linha do tempo</p>
          <ol className="grid grid-cols-12 gap-px">
            {group.rows.map((t) => {
              const isCurrent = t.billing_month === todayKey;
              const isPast = (t.billing_month ?? '') < todayKey;
              return (
                <li
                  key={t.id}
                  title={`${formatMonthBR(t.billing_month)} · ${formatBRL(t.amount)} · ${t.is_paid ? 'pago' : 'pendente'}`}
                  className={cn(
                    'h-5 rounded-sm transition-colors',
                    t.is_paid
                      ? 'bg-money-up/60'
                      : isPast
                        ? 'bg-money-down/60'
                        : isCurrent
                          ? 'bg-accent ring-1 ring-foreground/30'
                          : 'bg-rule/40',
                  )}
                />
              );
            })}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
