import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyForecastBalance,
  cashboxMonthlyForecast,
  cashboxRealMonth,
  cashboxBalance,
  calculateAllocation,
  type CashboxTransactionLike,
  type CashboxWithdrawalLike,
} from './cashboxes';

describe('calculateMonthlyForecastBalance', () => {
  it('soma entradas menos saídas do mês informado', () => {
    const txs = [
      { type: 'income' as const, amount: 5000, expense_month: '2026-08-01' },
      { type: 'expense' as const, amount: -2000, expense_month: '2026-08-01' },
      { type: 'income' as const, amount: 9999, expense_month: '2026-07-01' }, // fora do mês
    ];
    expect(calculateMonthlyForecastBalance(txs, '2026-08-01')).toBe(3000);
  });

  it('retorna 0 quando não há transações no mês', () => {
    expect(calculateMonthlyForecastBalance([], '2026-08-01')).toBe(0);
  });
});

describe('cashboxMonthlyForecast', () => {
  it('usa monthly_goal quando definida', () => {
    expect(cashboxMonthlyForecast({ id: 'c1', monthly_goal: 500 })).toBe(500);
  });

  it('retorna 0 quando monthly_goal é null', () => {
    expect(cashboxMonthlyForecast({ id: 'c1', monthly_goal: null })).toBe(0);
  });
});

function tx(over: Partial<CashboxTransactionLike>): CashboxTransactionLike {
  return {
    cashbox_id: 'c1',
    type: 'income',
    amount: 100,
    expense_month: '2026-08-01',
    ...over,
  };
}

function withdrawal(over: Partial<CashboxWithdrawalLike>): CashboxWithdrawalLike {
  return {
    cashbox_id: 'c1',
    amount: 50,
    withdrawal_date: '2026-08-10',
    ...over,
  };
}

describe('cashboxRealMonth', () => {
  it('soma entradas do mês vinculadas ao caixa, menos retiradas do mesmo mês', () => {
    const txs = [
      tx({ amount: 300, expense_month: '2026-08-01' }),
      tx({ amount: 200, expense_month: '2026-07-01' }), // outro mês
      tx({ cashbox_id: 'c2', amount: 999, expense_month: '2026-08-01' }), // outro caixa
      tx({ type: 'expense', amount: -50, expense_month: '2026-08-01' }), // despesa: nunca conta
    ];
    const withdrawals = [
      withdrawal({ amount: 100, withdrawal_date: '2026-08-15' }),
      withdrawal({ amount: 40, withdrawal_date: '2026-07-15' }), // outro mês
    ];
    expect(cashboxRealMonth('c1', '2026-08-01', txs, withdrawals)).toBe(200); // 300 - 100
  });

  it('retorna 0 sem entradas nem retiradas', () => {
    expect(cashboxRealMonth('c1', '2026-08-01', [], [])).toBe(0);
  });
});

describe('cashboxBalance', () => {
  it('soma entradas históricas menos retiradas históricas', () => {
    const txs = [
      tx({ amount: 300, expense_month: '2026-06-01' }),
      tx({ amount: 200, expense_month: '2026-08-01' }),
      tx({ cashbox_id: 'c2', amount: 999, expense_month: '2026-08-01' }),
    ];
    const withdrawals = [withdrawal({ amount: 700, withdrawal_date: '2026-08-15' })];
    expect(cashboxBalance('c1', txs, withdrawals)).toBe(-200); // 500 - 700
  });

  it('permite saldo negativo quando retirada > entradas', () => {
    const txs = [tx({ amount: 100 })];
    const withdrawals = [withdrawal({ amount: 250 })];
    expect(cashboxBalance('c1', txs, withdrawals)).toBe(-150);
  });
});

describe('calculateAllocation', () => {
  it('cada caixa recebe exatamente sua monthly_goal, resto vira não alocado', () => {
    const cashboxes = [
      { id: 'c1', monthly_goal: 2000 },
      { id: 'c2', monthly_goal: 1500 },
      { id: 'c3', monthly_goal: null },
    ];
    expect(calculateAllocation(cashboxes, 5000)).toEqual({ allocated: 3500, unallocated: 1500 });
  });

  it('unallocated fica negativo quando metas somadas excedem o previsto', () => {
    const cashboxes = [{ id: 'c1', monthly_goal: 6000 }];
    expect(calculateAllocation(cashboxes, 5000)).toEqual({ allocated: 6000, unallocated: -1000 });
  });
});
