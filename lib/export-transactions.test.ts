import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTransactionsWorkbook } from './export-transactions';
import type { TransactionRow, CardRow } from './supabase/types';

function transaction(over: Partial<TransactionRow>): TransactionRow {
  return {
    id: 't1',
    user_id: 'u1',
    description: 'Mercado',
    amount: 150,
    type: 'expense',
    payment_method: 'debit',
    category: 'Alimentação',
    notes: null,
    expense_month: '2026-09-01',
    billing_month: null,
    card_id: null,
    cashbox_id: null,
    is_recurring: false,
    is_paid: true,
    transaction_date: '2026-09-05',
    is_installment: false,
    installment_number: null,
    total_installments: null,
    installment_group_id: null,
    installment_end_date: null,
    created_at: '2026-09-05T00:00:00Z',
    ...over,
  };
}

function card(over: Partial<CardRow>): CardRow {
  return {
    id: 'c1',
    user_id: 'u1',
    name: 'Nubank',
    brand: null,
    limit_amount: null,
    closing_day: null,
    due_day: null,
    color: null,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

async function readSheet(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet('Lançamentos');
  if (!sheet) throw new Error('aba Lançamentos não encontrada');
  return sheet;
}

describe('buildTransactionsWorkbook', () => {
  it('gera aba "Lançamentos" com cabeçalho correto', async () => {
    const buffer = await buildTransactionsWorkbook([], []);
    const sheet = await readSheet(buffer);
    const headerValues = (sheet.getRow(1).values as unknown[]).slice(1);
    expect(headerValues).toEqual([
      'Data',
      'Descrição',
      'Categoria',
      'Tipo',
      'Método',
      'Valor',
      'Status',
      'Mês despesa',
      'Mês fatura',
      'Cartão',
      'Parcela',
    ]);
  });

  it('traduz tipo e método', async () => {
    const tx = transaction({ type: 'income', payment_method: 'pix' });
    const buffer = await buildTransactionsWorkbook([tx], []);
    const sheet = await readSheet(buffer);
    const row = sheet.getRow(2);
    expect(row.getCell(4).value).toBe('Receita');
    expect(row.getCell(5).value).toBe('Pix');
  });

  it('formata valor de receita como positivo e despesa como negativo', async () => {
    const income = transaction({ id: 't1', type: 'income', amount: 500 });
    const expense = transaction({ id: 't2', type: 'expense', amount: 200 });
    const buffer = await buildTransactionsWorkbook([income, expense], []);
    const sheet = await readSheet(buffer);
    expect(sheet.getRow(2).getCell(6).value).toBe(500);
    expect(sheet.getRow(3).getCell(6).value).toBe(-200);
  });

  it('resolve o nome do cartão a partir do card_id', async () => {
    const tx = transaction({ card_id: 'c1' });
    const buffer = await buildTransactionsWorkbook([tx], [card({ id: 'c1', name: 'Nubank' })]);
    const sheet = await readSheet(buffer);
    expect(sheet.getRow(2).getCell(10).value).toBe('Nubank');
  });

  it('deixa a coluna Cartão vazia quando o cartão não é encontrado', async () => {
    const tx = transaction({ card_id: 'inexistente' });
    const buffer = await buildTransactionsWorkbook([tx], []);
    const sheet = await readSheet(buffer);
    expect(sheet.getRow(2).getCell(10).value).toBe('');
  });

  it('monta a coluna Parcela apenas quando is_installment é true', async () => {
    const installment = transaction({
      id: 't1',
      is_installment: true,
      installment_number: 3,
      total_installments: 12,
    });
    const single = transaction({ id: 't2', is_installment: false });
    const buffer = await buildTransactionsWorkbook([installment, single], []);
    const sheet = await readSheet(buffer);
    expect(sheet.getRow(2).getCell(11).value).toBe('3/12');
    expect(sheet.getRow(3).getCell(11).value).toBe('');
  });

  it('lista vazia gera workbook só com o cabeçalho, sem erro', async () => {
    const buffer = await buildTransactionsWorkbook([], []);
    const sheet = await readSheet(buffer);
    expect(sheet.rowCount).toBe(1);
  });
});
