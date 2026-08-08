// app/(app)/cashflow/page.tsx
import { createClient } from '@/lib/supabase/server';
import { firstDayOfMonth, toISODate } from '@/lib/format';
import type {
  CashboxRow,
  CashboxDepositRow,
  CashboxWithdrawalRow,
  TransactionRow,
} from '@/lib/supabase/types';
import { CashflowView } from './_view';

export const dynamic = 'force-dynamic';

export default async function CashflowPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const currentMonthKey = toISODate(firstDayOfMonth(new Date()));

  const [
    { data: cashboxes, error: cashboxesError },
    { data: deposits, error: depositsError },
    { data: monthTxs, error: monthTxsError },
    { data: withdrawals, error: withdrawalsError },
  ] = await Promise.all([
    supabase.from('cashboxes').select('*').order('created_at', { ascending: true }),
    supabase
      .from('cashbox_deposits')
      .select('*')
      .order('deposit_date', { ascending: false })
      .limit(2000),
    supabase.from('transactions').select('*').eq('expense_month', currentMonthKey),
    supabase
      .from('cashbox_withdrawals')
      .select('*')
      .order('withdrawal_date', { ascending: false })
      .limit(2000),
  ]);

  if (cashboxesError) console.error('[cashflow cashboxes]', cashboxesError);
  if (depositsError) console.error('[cashflow deposits]', depositsError);
  if (monthTxsError) console.error('[cashflow monthTxs]', monthTxsError);
  if (withdrawalsError) console.error('[cashflow withdrawals]', withdrawalsError);

  return (
    <CashflowView
      userId={user.id}
      currentMonthKey={currentMonthKey}
      cashboxes={(cashboxes ?? []) as CashboxRow[]}
      deposits={(deposits ?? []) as CashboxDepositRow[]}
      monthTransactions={(monthTxs ?? []) as TransactionRow[]}
      withdrawals={(withdrawals ?? []) as CashboxWithdrawalRow[]}
    />
  );
}
