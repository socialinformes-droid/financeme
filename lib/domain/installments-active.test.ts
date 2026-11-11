import { describe, expect, it } from 'vitest';
import {
  createInstallmentTransactions,
  createRecurringTransactions,
  groupResize,
  type GroupRow,
} from '@/lib/domain/installments';

const base = {
  user_id: 'u1',
  description: 'Viagem',
  category: 'Lazer',
  paymentMethod: 'debit' as const,
  startDate: new Date('2026-11-10T12:00:00'),
};

describe('geração com isActive', () => {
  it('parcelas nascem ativas por padrão', () => {
    const rows = createInstallmentTransactions({ ...base, totalAmount: 300, installments: 3 });
    expect(rows.every((r) => r.is_active === true)).toBe(true);
  });
  it('parcelas nascem previstas com isActive false', () => {
    const rows = createInstallmentTransactions({
      ...base,
      totalAmount: 300,
      installments: 3,
      isActive: false,
    });
    expect(rows.every((r) => r.is_active === false)).toBe(true);
  });
  it('recorrentes respeitam isActive', () => {
    const planned = createRecurringTransactions({
      ...base,
      amount: 100,
      type: 'expense',
      months: 3,
      isActive: false,
    });
    expect(planned.every((r) => r.is_active === false)).toBe(true);
    const active = createRecurringTransactions({ ...base, amount: 100, type: 'expense', months: 3 });
    expect(active.every((r) => r.is_active === true)).toBe(true);
  });
});

describe('groupResize herda is_active', () => {
  it('novas parcelas de um grupo previsto também nascem previstas', () => {
    const generated = createInstallmentTransactions({
      ...base,
      totalAmount: 200,
      installments: 2,
      isActive: false,
    });
    const rows: GroupRow[] = generated.map((r, i) => ({ ...r, id: `r${i}` }));
    const { toInsert } = groupResize({ rows, newTotal: 4 });
    expect(toInsert).toHaveLength(2);
    expect(toInsert.every((r) => r.is_active === false)).toBe(true);
  });
  it('novas ocorrências de um grupo recorrente previsto também nascem previstas', () => {
    const generated = createRecurringTransactions({
      ...base,
      amount: 50,
      type: 'expense',
      months: 2,
      isActive: false,
    });
    const rows: GroupRow[] = generated.map((r, i) => ({ ...r, id: `r${i}` }));
    const { toInsert } = groupResize({ rows, newTotal: 3 });
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0].is_active).toBe(false);
  });
});
