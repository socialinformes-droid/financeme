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

  const [{ data: byExpense }, { data: byBilling }, { data: cards }, { data: categories }] =
    await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .gte('expense_month', startOfYear)
        .lt('expense_month', endOfYear)
        .order('transaction_date', { ascending: false })
        .limit(2000),
      // A lista tem filtro/coluna por billing_month (mês fatura). Perto do fechamento
      // do cartão, expense_month e billing_month podem cair em anos diferentes (ex:
      // compra em dez/26 com fatura em jan/27) — sem esta query, a linha só aparece
      // quando o ano selecionado bate com o expense_month, nunca com o billing_month.
      supabase
        .from('transactions')
        .select('*')
        .gte('billing_month', startOfYear)
        .lt('billing_month', endOfYear)
        .order('transaction_date', { ascending: false })
        .limit(2000),
      supabase.from('cards').select('*').order('name'),
      supabase.from('categories').select('*').eq('is_active', true).order('name'),
    ]);

  const txMap = new Map<string, TransactionRow>();
  for (const t of (byExpense ?? []) as TransactionRow[]) txMap.set(t.id, t);
  for (const t of (byBilling ?? []) as TransactionRow[]) txMap.set(t.id, t);

  // Filtra placeholders Cartão zerados (criados por ensureCardFaturasForYear) — eles
  // só servem ao FaturaGrid e ao pivot, não devem listar como "lançamento" pendente.
  const transactions = [...txMap.values()].filter(
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
