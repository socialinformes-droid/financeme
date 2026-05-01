import { createClient } from '@/lib/supabase/server';
import type { CardRow, TransactionRow } from '@/lib/supabase/types';
import { resolveYearWithCookie } from '@/lib/domain/years';
import { ensureCardFaturasForYear } from '@/lib/domain/card-faturas';
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
  const year = await resolveYearWithCookie(yearParam);
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year + 1}-01-01`;

  // Garante 12 placeholders R$0 (cartão × mês do ano) — só insere o que falta.
  // Idempotente. Faz "lazy bootstrap" pra cada ano que o user navegar.
  const { data: cards } = await supabase.from('cards').select('*').order('name');
  await ensureCardFaturasForYear(supabase, user.id, year, (cards ?? []) as CardRow[]);

  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .gte('billing_month', startOfYear)
    .lt('billing_month', endOfYear)
    .order('billing_month', { ascending: false })
    .limit(2000);

  return (
    <CardsView
      userId={user.id}
      initialCards={(cards ?? []) as CardRow[]}
      transactions={(txs ?? []) as TransactionRow[]}
      year={year}
    />
  );
}
