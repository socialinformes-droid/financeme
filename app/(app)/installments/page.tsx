import { createClient } from '@/lib/supabase/server';
import { toISODate, firstDayOfMonth } from '@/lib/format';
import { resolveYear } from '@/lib/domain/years';
import type { TransactionRow, CardRow, CategoryRow } from '@/lib/supabase/types';
import { InstallmentsView, type Group } from './_view';

export const dynamic = 'force-dynamic';

export default async function InstallmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { year: yearParam } = await searchParams;
  const year = resolveYear(yearParam);
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year + 1}-01-01`;

  const [{ data: transactions }, { data: cards }, { data: categories }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('is_installment', true)
      .order('billing_month', { ascending: true }),
    supabase.from('cards').select('*').order('name'),
    supabase.from('categories').select('*').eq('is_active', true).order('name'),
  ]);

  const allTxs = (transactions ?? []) as TransactionRow[];
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
  const groupsActiveInYear = new Set<string>();
  for (const [gid, { start, end }] of groupBounds) {
    if (start < endOfYear && end >= startOfYear) groupsActiveInYear.add(gid);
  }
  const txs = allTxs.filter(
    (t) => t.installment_group_id && groupsActiveInYear.has(t.installment_group_id),
  );

  const map = new Map<string, TransactionRow[]>();
  for (const t of txs) {
    if (!t.installment_group_id) continue;
    const arr = map.get(t.installment_group_id) ?? [];
    arr.push(t);
    map.set(t.installment_group_id, arr);
  }

  const todayKey = toISODate(firstDayOfMonth(new Date()));

  const groups: Group[] = [...map.entries()]
    .map(([groupId, rows]): Group => {
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
      const order = { active: 0, upcoming: 1, finished: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return a.endMonth.localeCompare(b.endMonth);
    });

  return (
    <InstallmentsView
      userId={user.id}
      groups={groups}
      cards={(cards ?? []) as CardRow[]}
      categories={(categories ?? []) as CategoryRow[]}
      year={year}
      todayKey={todayKey}
    />
  );
}
