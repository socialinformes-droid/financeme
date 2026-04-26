import { createClient } from '@/lib/supabase/server';
import type { CardRow, TransactionRow } from '@/lib/supabase/types';
import { resolveYear } from '@/lib/domain/years';
import { CardsView } from './_view';

export const dynamic = 'force-dynamic';

export default async function CardsPage({
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

  // Pega tudo do ano (com card_id ou category=Cartão pra grade)
  const [{ data: cards }, { data: txs }] = await Promise.all([
    supabase.from('cards').select('*').order('name'),
    supabase
      .from('transactions')
      .select('*')
      .gte('billing_month', startOfYear)
      .lt('billing_month', endOfYear)
      .order('billing_month', { ascending: false })
      .limit(2000),
  ]);

  return (
    <CardsView
      userId={user.id}
      initialCards={(cards ?? []) as CardRow[]}
      transactions={(txs ?? []) as TransactionRow[]}
      year={year}
    />
  );
}
