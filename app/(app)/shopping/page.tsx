import { createClient } from '@/lib/supabase/server';
import type { ShoppingItemRow, TransactionRow } from '@/lib/supabase/types';
import { firstDayOfMonth, toISODate } from '@/lib/format';
import { ShoppingView } from './_view';

export const dynamic = 'force-dynamic';

export default async function ShoppingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const today = toISODate(firstDayOfMonth(new Date()));

  const [{ data: items }, { data: futureTxs }] = await Promise.all([
    supabase.from('shopping_list').select('*').order('created_at', { ascending: false }),
    // Saldo previsto = soma de transactions deste mês em diante
    supabase
      .from('transactions')
      .select('expense_month,type,amount')
      .gte('expense_month', today)
      .order('expense_month', { ascending: true }),
  ]);

  // Calcula saldo previsto líquido (entradas - saídas) e por mês
  const txs = (futureTxs ?? []) as Pick<TransactionRow, 'expense_month' | 'type' | 'amount'>[];
  const monthlyBalance: Record<string, number> = {};
  let totalForecast = 0;
  for (const t of txs) {
    if (!t.expense_month) continue;
    monthlyBalance[t.expense_month] =
      (monthlyBalance[t.expense_month] ?? 0) + Number(t.amount);
    totalForecast += Number(t.amount);
  }

  return (
    <ShoppingView
      userId={user.id}
      initial={(items ?? []) as ShoppingItemRow[]}
      forecast={{
        startMonth: today,
        totalForecast,
        monthlyBalance,
      }}
    />
  );
}
