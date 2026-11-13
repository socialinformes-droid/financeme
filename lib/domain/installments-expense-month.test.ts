import { describe, expect, it } from 'vitest';
import {
  createInstallmentTransactions,
  createRecurringTransactions,
  groupResize,
  type GroupRow,
} from '@/lib/domain/installments';

const base = {
  user_id: 'u1',
  description: 'Notebook',
  category: 'Tecnologia',
  startDate: new Date('2026-10-10T12:00:00'),
};

describe('expense_month desliza por parcela', () => {
  it('cada parcela cai no seu próprio mês, atravessando o ano', () => {
    const rows = createInstallmentTransactions({
      ...base,
      paymentMethod: 'debit',
      totalAmount: 500,
      installments: 5,
    });
    expect(rows.map((r) => r.expense_month)).toEqual([
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
    // débito: fatura e gasto coincidem
    expect(rows.map((r) => r.billing_month)).toEqual(rows.map((r) => r.expense_month));
    // data da compra continua fixa em todas
    expect(rows.every((r) => r.transaction_date === '2026-10-10')).toBe(true);
  });

  it('crédito após o fechamento mantém offset constante entre gasto e fatura', () => {
    const rows = createInstallmentTransactions({
      ...base,
      paymentMethod: 'credit',
      card: { closing_day: 5 },
      totalAmount: 300,
      installments: 3,
    });
    expect(rows.map((r) => r.expense_month)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
    expect(rows.map((r) => r.billing_month)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
  });

  it('mantém a mesma convenção das recorrentes', () => {
    const inst = createInstallmentTransactions({
      ...base,
      paymentMethod: 'pix',
      totalAmount: 300,
      installments: 3,
    });
    const rec = createRecurringTransactions({
      ...base,
      paymentMethod: 'pix',
      amount: 100,
      type: 'expense',
      months: 3,
    });
    expect(inst.map((r) => r.expense_month)).toEqual(rec.map((r) => r.expense_month));
  });
});

describe('groupResize continua a sequência de expense_month', () => {
  it('parcelas novas seguem o deslize a partir da primeira linha', () => {
    const generated = createInstallmentTransactions({
      ...base,
      paymentMethod: 'credit',
      card: { closing_day: 5 },
      totalAmount: 200,
      installments: 2,
    });
    const rows: GroupRow[] = generated.map((r, i) => ({ ...r, id: `r${i}` }));
    const { toInsert } = groupResize({ rows, newTotal: 4 });
    expect(toInsert.map((r) => r.expense_month)).toEqual(['2026-12-01', '2027-01-01']);
    expect(toInsert.map((r) => r.billing_month)).toEqual(['2027-01-01', '2027-02-01']);
  });

  it('grupo legado com expense_month fixo passa a deslizar a partir da primeira', () => {
    // Antes da migration 0007, todas as parcelas tinham expense_month = mês da compra.
    const legacy: GroupRow[] = [1, 2].map((n) => ({
      id: `l${n}`,
      user_id: 'u1',
      description: `Sofá (${n}/2)`,
      amount: -100,
      type: 'expense',
      payment_method: 'credit',
      category: 'Casa',
      notes: null,
      expense_month: '2026-06-01',
      billing_month: `2026-0${6 + n}-01`,
      card_id: null,
      is_recurring: false,
      is_paid: false,
      is_active: true,
      transaction_date: '2026-06-20',
      is_installment: true,
      installment_number: n,
      total_installments: 2,
      installment_group_id: 'g1',
      installment_end_date: '2026-08-01',
    }));
    const { toInsert } = groupResize({ rows: legacy, newTotal: 3 });
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0].expense_month).toBe('2026-08-01');
    expect(toInsert[0].billing_month).toBe('2026-09-01');
  });
});
