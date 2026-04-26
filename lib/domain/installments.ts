import { addMonths, firstDayOfMonth, toISODate } from '@/lib/format';
import { calculateBillingMonth, type CardForBilling } from '@/lib/domain/billing';

export type InstallmentInput = {
  user_id: string;
  description: string;
  totalAmount: number;
  installments: number;
  startDate: Date;
  category: string;
  paymentMethod: 'credit' | 'debit' | 'pix' | 'cash';
  cardId?: string | null;
  card?: CardForBilling | null;
  notes?: string | null;
  isRecurring?: boolean;
  groupId?: string;
};

export type InstallmentRow = {
  user_id: string;
  description: string;
  amount: number;
  type: 'expense';
  payment_method: 'credit' | 'debit' | 'pix' | 'cash';
  category: string;
  notes: string | null;
  expense_month: string;
  billing_month: string;
  card_id: string | null;
  is_recurring: boolean;
  is_paid: boolean;
  transaction_date: string;
  is_installment: true;
  installment_number: number;
  total_installments: number;
  installment_group_id: string;
  installment_end_date: string;
};

/**
 * Gera N transações para uma compra parcelada.
 *
 * - `amount` é o valor da parcela (totalAmount/N), com a última parcela ajustada
 *    para absorver os centavos de arredondamento.
 * - `expense_month` é o primeiro dia do mês da `startDate` para todas as parcelas
 *    (o gasto aconteceu agora — só o débito é diferido).
 * - `billing_month` é calculado mês a mês a partir da `startDate`.
 * - `installment_group_id` é o mesmo UUID em todas, permitindo cancelar o grupo.
 */
export function createInstallmentTransactions(input: InstallmentInput): InstallmentRow[] {
  if (input.installments < 1) throw new Error('installments deve ser >= 1');
  if (input.totalAmount <= 0) throw new Error('totalAmount deve ser > 0');

  const groupId = input.groupId ?? cryptoUUID();
  const expenseMonth = toISODate(firstDayOfMonth(input.startDate));
  const startBilling = calculateBillingMonth(
    input.startDate,
    input.paymentMethod,
    input.card ?? null,
  );

  const rounded = Math.round((input.totalAmount / input.installments) * 100) / 100;
  const sumExceptLast = +(rounded * (input.installments - 1)).toFixed(2);
  const lastAmount = +(input.totalAmount - sumExceptLast).toFixed(2);

  const startBillingDate = new Date(`${startBilling}T00:00:00Z`);
  const endBillingDate = addMonths(startBillingDate, input.installments - 1);
  const installmentEndDate = toISODate(endBillingDate);

  const rows: InstallmentRow[] = [];
  for (let i = 0; i < input.installments; i++) {
    const billingDate = addMonths(startBillingDate, i);
    const isLast = i === input.installments - 1;
    rows.push({
      user_id: input.user_id,
      description: `${input.description} (${i + 1}/${input.installments})`,
      amount: -(isLast ? lastAmount : rounded),
      type: 'expense',
      payment_method: input.paymentMethod,
      category: input.category,
      notes: input.notes ?? null,
      expense_month: expenseMonth,
      billing_month: toISODate(billingDate),
      card_id: input.cardId ?? null,
      is_recurring: !!input.isRecurring,
      is_paid: false,
      transaction_date: toISODate(input.startDate),
      is_installment: true,
      installment_number: i + 1,
      total_installments: input.installments,
      installment_group_id: groupId,
      installment_end_date: installmentEndDate,
    });
  }
  return rows;
}

function cryptoUUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // fallback v4-ish
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
