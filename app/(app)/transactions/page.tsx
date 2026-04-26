import { createClient } from '@/lib/supabase/server';
import type { TransactionRow, CardRow } from '@/lib/supabase/types';
import { TransactionsView } from './_view';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: transactions }, { data: cards }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false })
      .limit(500),
    supabase.from('cards').select('*').order('name'),
  ]);

  return (
    <TransactionsView
      userId={user.id}
      initialTransactions={(transactions ?? []) as TransactionRow[]}
      cards={(cards ?? []) as CardRow[]}
    />
  );
}
