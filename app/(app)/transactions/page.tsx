import { createClient } from '@/lib/supabase/server';
import type { TransactionRow, CardRow } from '@/lib/supabase/types';
import { resolveYear } from '@/lib/domain/years';
import { TransactionsView } from './_view';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({
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

  const [{ data: transactions }, { data: cards }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .gte('expense_month', startOfYear)
      .lt('expense_month', endOfYear)
      .order('transaction_date', { ascending: false })
      .limit(2000),
    supabase.from('cards').select('*').order('name'),
  ]);

  return (
    <TransactionsView
      userId={user.id}
      initialTransactions={(transactions ?? []) as TransactionRow[]}
      cards={(cards ?? []) as CardRow[]}
      year={year}
    />
  );
}
