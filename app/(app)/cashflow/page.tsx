// app/(app)/cashflow/page.tsx
import { createClient } from '@/lib/supabase/server';
import { firstDayOfMonth, toISODate } from '@/lib/format';
import type { CashboxRow, CashboxWithdrawalRow, TransactionRow } from '@/lib/supabase/types';
import { CashflowView } from './_view';

export const dynamic = 'force-dynamic';

export default async function CashflowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const currentMonthKey = toISODate(firstDayOfMonth(new Date()));

  const [{ data: cashboxes }, { data: cashboxTxs }, { data: monthTxs }, { data: withdrawals }] =
    await Promise.all([
      supabase.from('cashboxes').select('*').order('created_at', { ascending: true }),
      supabase.from('transactions').select('*').eq('type', 'income').not('cashbox_id', 'is', null),
      supabase.from('transactions').select('*').eq('expense_month', currentMonthKey),
      supabase
        .from('cashbox_withdrawals')
        .select('*')
        .order('withdrawal_date', { ascending: false }),
    ]);

  return (
    <CashflowView
      userId={user.id}
      currentMonthKey={currentMonthKey}
      cashboxes={(cashboxes ?? []) as CashboxRow[]}
      cashboxTransactions={(cashboxTxs ?? []) as TransactionRow[]}
      monthTransactions={(monthTxs ?? []) as TransactionRow[]}
      withdrawals={(withdrawals ?? []) as CashboxWithdrawalRow[]}
    />
  );
}
