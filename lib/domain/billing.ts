import { addMonths, firstDayOfMonth, toISODate } from '@/lib/format';

export type CardForBilling = {
  closing_day: number | null;
};

/**
 * Calcula o `billing_month` (primeiro dia do mês de fatura) de uma transação no crédito.
 *
 * Regra: se o dia da compra for menor ou igual ao dia de fechamento do cartão,
 * a compra cai na fatura desse mês. Senão, vai para a fatura do mês seguinte.
 *
 * Para débito/pix/cash: `billing_month` = primeiro dia do mês da própria transação.
 */
export function calculateBillingMonth(
  transactionDate: Date,
  paymentMethod: 'credit' | 'debit' | 'pix' | 'cash',
  card: CardForBilling | null,
): string {
  if (paymentMethod !== 'credit' || !card?.closing_day) {
    return toISODate(firstDayOfMonth(transactionDate));
  }

  const day = transactionDate.getDate();
  const base =
    day <= card.closing_day
      ? firstDayOfMonth(transactionDate)
      : firstDayOfMonth(addMonths(transactionDate, 1));
  return toISODate(base);
}
