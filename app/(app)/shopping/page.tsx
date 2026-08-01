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
    // Saldo previsto = soma de transactions deste mês em diante, por billing_month (fatura/quando
    // o dinheiro efetivamente sai) — não por expense_month, que em compras parceladas fica travado
    // no mês da compra original e some da previsão assim que passa da janela de "deste mês em diante".
    supabase
      .from('transactions')
      .select('billing_month,type,amount')
      .gte('billing_month', today)
      .order('billing_month', { ascending: true }),
  ]);

  // Calcula saldo previsto líquido (entradas - saídas) e por mês
  const txs = (futureTxs ?? []) as Pick<TransactionRow, 'billing_month' | 'type' | 'amount'>[];
  const monthlyBalance: Record<string, number> = {};
  let totalForecast = 0;
  for (const t of txs) {
    if (!t.billing_month) continue;
    monthlyBalance[t.billing_month] =
      (monthlyBalance[t.billing_month] ?? 0) + Number(t.amount);
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
