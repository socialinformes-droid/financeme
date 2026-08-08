import type { TransactionRow } from '@/lib/supabase/types';

export type CashboxLike = {
  id: string;
  monthly_goal: number | null;
};

export type CashboxDepositLike = {
  cashbox_id: string;
  amount: number;
  deposit_date: string;
};

export type CashboxWithdrawalLike = {
  cashbox_id: string;
  amount: number;
  withdrawal_date: string;
};

/**
 * Saldo previsto do mês = entradas - saídas de transações cujo expense_month
 * é o mês informado. Mesma regra do card "Saldo do mês" do Dashboard.
 */
export function calculateMonthlyForecastBalance(
  transactions: Pick<TransactionRow, 'type' | 'amount' | 'expense_month'>[],
  monthKey: string,
): number {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.expense_month !== monthKey) continue;
    if (t.type === 'income') income += Number(t.amount);
    else expense += Math.abs(Number(t.amount));
  }
  return income - expense;
}

/** Previsto do mês pro caixa = monthly_goal, ou 0 se não definida. */
export function cashboxMonthlyForecast(cashbox: CashboxLike): number {
  return Number(cashbox.monthly_goal ?? 0);
}

/** Real do mês = depósitos no caixa no mês, menos retiradas do mesmo mês. */
export function cashboxRealMonth(
  cashboxId: string,
  monthKey: string,
  deposits: CashboxDepositLike[],
  withdrawals: CashboxWithdrawalLike[],
): number {
  const monthPrefix = monthKey.slice(0, 7);
  const deposited = deposits
    .filter((d) => d.cashbox_id === cashboxId && d.deposit_date.slice(0, 7) === monthPrefix)
    .reduce((a, d) => a + Number(d.amount), 0);
  const withdrawn = withdrawals
    .filter((w) => w.cashbox_id === cashboxId && w.withdrawal_date.slice(0, 7) === monthPrefix)
    .reduce((a, w) => a + Number(w.amount), 0);
  return deposited - withdrawn;
}

/** Saldo acumulado (histórico total) = depósitos - retiradas. Pode ser negativo. */
export function cashboxBalance(
  cashboxId: string,
  deposits: CashboxDepositLike[],
  withdrawals: CashboxWithdrawalLike[],
): number {
  const deposited = deposits
    .filter((d) => d.cashbox_id === cashboxId)
    .reduce((a, d) => a + Number(d.amount), 0);
  const withdrawn = withdrawals
    .filter((w) => w.cashbox_id === cashboxId)
    .reduce((a, w) => a + Number(w.amount), 0);
  return deposited - withdrawn;
}

export type AllocationSummary = { allocated: number; unallocated: number };

/**
 * Cada caixa recebe exatamente sua monthly_goal (sem rateio proporcional).
 * O que sobra do saldo previsto do mês fica "não alocado".
 */
export function calculateAllocation(
  cashboxes: CashboxLike[],
  forecastBalance: number,
): AllocationSummary {
  const allocated = cashboxes.reduce((a, c) => a + cashboxMonthlyForecast(c), 0);
  return { allocated, unallocated: forecastBalance - allocated };
}
