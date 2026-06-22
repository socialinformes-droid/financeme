import { describe, it, expect } from 'vitest';
import { isLumpFatura, composeFatura } from './card-fatura-composition';
import type { TransactionRow } from '@/lib/supabase/types';

// fábrica mínima — só os campos que o helper lê
function tx(over: Partial<TransactionRow>): TransactionRow {
  return {
    id: crypto.randomUUID(),
    user_id: 'u1',
    description: 'x',
    amount: 100,
    type: 'expense',
    payment_method: 'credit',
    category: 'Outros',
    notes: null,
    expense_month: null,
    billing_month: '2026-06-01',
    card_id: 'c1',
    is_recurring: false,
    is_paid: false,
    transaction_date: '2026-06-01',
    is_installment: false,
    installment_number: null,
    total_installments: null,
    installment_group_id: null,
    installment_end_date: null,
    created_at: '2026-06-01T00:00:00Z',
    ...over,
  } as TransactionRow;
}

describe('isLumpFatura', () => {
  it('é true para category Cartão sem parênteses', () => {
    expect(isLumpFatura(tx({ category: 'Cartão', description: 'Fatura junho' }))).toBe(true);
  });
  it('é false para category Cartão itemizada (com parênteses)', () => {
    expect(isLumpFatura(tx({ category: 'Cartão', description: 'Netflix (3/10)' }))).toBe(false);
  });
  it('é false para outras categorias', () => {
    expect(isLumpFatura(tx({ category: 'Streaming', description: 'Netflix' }))).toBe(false);
  });
});

describe('composeFatura', () => {
  const cardId = 'c1';
  const month = '2026-06-01';

  it('classifica de forma exclusiva: recorrente > parcelado > avulso', () => {
    const txs = [
      tx({ is_recurring: true, amount: 50, description: 'Spotify' }),
      tx({ is_installment: true, installment_number: 3, total_installments: 10, amount: 200, description: 'TV (3/10)' }),
      tx({ amount: 30, description: 'Padaria' }),
      tx({ is_recurring: true, is_installment: true, amount: 70, description: 'Plano' }),
    ];
    const c = composeFatura(txs, cardId, month);
    expect(c.fixed).toHaveLength(2);
    expect(c.installments).toHaveLength(1);
    expect(c.oneOff).toHaveLength(1);
    expect(c.fixedTotal).toBe(120);
    expect(c.installmentsTotal).toBe(200);
    expect(c.oneOffTotal).toBe(30);
    expect(c.total).toBe(350);
  });

  it('inclui a linha base não-itemizada em oneOff via baseAmount', () => {
    const txs = [
      tx({ category: 'Cartão', description: 'Fatura junho', amount: 500 }),
      tx({ amount: 30, description: 'Padaria' }),
    ];
    const c = composeFatura(txs, cardId, month);
    expect(c.baseAmount).toBe(500);
    expect(c.oneOff).toHaveLength(1);
    expect(c.oneOffTotal).toBe(530);
    expect(c.total).toBe(530);
  });

  it('ignora placeholders (Cartão com amount 0)', () => {
    const txs = [tx({ category: 'Cartão', description: 'Fatura', amount: 0 })];
    const c = composeFatura(txs, cardId, month);
    expect(c.total).toBe(0);
    expect(c.baseAmount).toBe(0);
  });

  it('filtra por cartão e mês e ignora income', () => {
    const txs = [
      tx({ amount: 30 }),
      tx({ card_id: 'outro', amount: 999 }),
      tx({ billing_month: '2026-07-01', amount: 888 }),
      tx({ type: 'income', amount: 777 }),
      tx({ billing_month: null, amount: 666 }),
    ];
    const c = composeFatura(txs, cardId, month);
    expect(c.total).toBe(30);
  });

  it('monta installmentLabel a partir de number/total', () => {
    const txs = [tx({ is_installment: true, installment_number: 3, total_installments: 10, description: 'TV' })];
    const c = composeFatura(txs, cardId, month);
    expect(c.installments[0].installmentLabel).toBe('3/10');
  });
});
