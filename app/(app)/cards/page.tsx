import { createClient } from '@/lib/supabase/server';
import type { CardRow, TransactionRow } from '@/lib/supabase/types';
import { CardsView } from './_view';

export const dynamic = 'force-dynamic';

export default async function CardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: cards }, { data: txs }] = await Promise.all([
    supabase.from('cards').select('*').order('name'),
    supabase
      .from('transactions')
      .select('*')
      .not('card_id', 'is', null)
      .order('billing_month', { ascending: false })
      .limit(2000),
  ]);

  return (
    <CardsView
      userId={user.id}
      initialCards={(cards ?? []) as CardRow[]}
      transactions={(txs ?? []) as TransactionRow[]}
    />
  );
}
