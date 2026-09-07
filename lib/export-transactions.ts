import ExcelJS from 'exceljs';
import { formatDateBR, formatMonthBR } from './format';
import type { TransactionRow, CardRow } from './supabase/types';

const TYPE_LABEL: Record<TransactionRow['type'], string> = {
  income: 'Receita',
  expense: 'Despesa',
};

const METHOD_LABEL: Record<TransactionRow['payment_method'], string> = {
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'Pix',
  cash: 'Dinheiro',
};

const INCOME_COLOR = 'FF16A34A';
const EXPENSE_COLOR = 'FFDC2626';
const HEADER_FILL = 'FFE5E7EB';

export async function buildTransactionsWorkbook(
  transactions: TransactionRow[],
  cards: CardRow[],
): Promise<ArrayBuffer> {
  const cardNameById = new Map(cards.map((c) => [c.id, c.name]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lançamentos');

  sheet.columns = [
    { header: 'Data', key: 'date', width: 12 },
    { header: 'Descrição', key: 'description', width: 32 },
    { header: 'Categoria', key: 'category', width: 18 },
    { header: 'Tipo', key: 'type', width: 10 },
    { header: 'Método', key: 'method', width: 10 },
    { header: 'Valor', key: 'amount', width: 14 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Mês despesa', key: 'expenseMonth', width: 12 },
    { header: 'Mês fatura', key: 'billingMonth', width: 12 },
    { header: 'Cartão', key: 'card', width: 16 },
    { header: 'Parcela', key: 'installment', width: 10 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });

  for (const t of transactions) {
    const signedAmount =
      t.type === 'income' ? Math.abs(Number(t.amount)) : -Math.abs(Number(t.amount));

    const row = sheet.addRow({
      date: formatDateBR(t.transaction_date),
      description: t.description,
      category: t.category,
      type: TYPE_LABEL[t.type],
      method: METHOD_LABEL[t.payment_method],
      amount: signedAmount,
      status: t.is_paid ? 'Pago' : 'Pendente',
      expenseMonth: formatMonthBR(t.expense_month),
      billingMonth: formatMonthBR(t.billing_month),
      card: t.card_id ? (cardNameById.get(t.card_id) ?? '') : '',
      installment:
        t.is_installment && t.installment_number && t.total_installments
          ? `${t.installment_number}/${t.total_installments}`
          : '',
    });

    const amountCell = row.getCell('amount');
    amountCell.numFmt = '"R$" #,##0.00';
    amountCell.font = { color: { argb: t.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
