import { createClient } from '@/lib/supabase/server';
import type { TransactionRow, CardRow, CategoryRow } from '@/lib/supabase/types';
import { resolveYearWithCookie } from '@/lib/domain/years';
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
  const year = await resolveYearWithCookie(yearParam);
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year + 1}-01-01`;

  const [{ data: rawTransactions }, { data: cards }, { data: categories }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .gte('expense_month', startOfYear)
      .lt('expense_month', endOfYear)
      .order('transaction_date', { ascending: false })
      .limit(2000),
    supabase.from('cards').select('*').order('name'),
    supabase.from('categories').select('*').eq('is_active', true).order('name'),
  ]);

  // Filtra placeholders Cartão zerados (criados por ensureCardFaturasForYear) — eles
  // só servem ao FaturaGrid e ao pivot, não devem listar como "lançamento" pendente.
  const transactions = (rawTransactions ?? []).filter(
    (t) => !(t.category === 'Cartão' && Number(t.amount) === 0),
  );

  return (
    <TransactionsView
      userId={user.id}
      initialTransactions={(transactions ?? []) as TransactionRow[]}
      cards={(cards ?? []) as CardRow[]}
      categories={(categories ?? []) as CategoryRow[]}
      year={year}
    />
  );
}
