import { addMonthsToISO, firstDayOfMonth, toISODate } from '@/lib/format';
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

  const installmentEndDate = addMonthsToISO(startBilling, input.installments - 1);

  const rows: InstallmentRow[] = [];
  for (let i = 0; i < input.installments; i++) {
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
      billing_month: addMonthsToISO(startBilling, i),
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

// ─── Group operations ────────────────────────────────────────────────────────
//
// Helpers puros que recebem as linhas atuais de um grupo e retornam patches
// (insert/update/delete) pra UI executar via Supabase. Mantê-los puros facilita
// teste e separa a lógica de dominio da camada de I/O.

export type GroupRow = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  payment_method: 'credit' | 'debit' | 'pix' | 'cash';
  category: string;
  notes: string | null;
  expense_month: string | null;
  billing_month: string | null;
  card_id: string | null;
  is_recurring: boolean;
  is_paid: boolean;
  transaction_date: string;
  is_installment: boolean;
  installment_number: number | null;
  total_installments: number | null;
  installment_group_id: string | null;
  installment_end_date: string | null;
};

export type RowPatch = { id: string; patch: Partial<GroupRow> };

export function stripInstallmentSuffix(s: string): string {
  return s.replace(/\s*\(\d+\/\d+\)\s*$/, '');
}

export function withInstallmentSuffix(base: string, n: number, total: number): string {
  return `${stripInstallmentSuffix(base)} (${n}/${total})`;
}

function sortByNumber(rows: GroupRow[]): GroupRow[] {
  return [...rows].sort(
    (a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0),
  );
}

/**
 * Resize do grupo (mudar nº total de parcelas).
 *
 * - Reduzir: deleta as últimas (independente de pago, conforme spec do usuário)
 *   e atualiza `total_installments`/`installment_end_date`/sufixo das remanescentes.
 * - Aumentar: cria novas linhas no fim com mesmo valor da primeira linha,
 *   `billing_month` continuando a sequência mensal, `is_paid=false`.
 */
export function groupResize(opts: {
  rows: GroupRow[];
  newTotal: number;
}): { toDelete: string[]; toInsert: InstallmentRow[]; toUpdate: RowPatch[] } {
  const sorted = sortByNumber(opts.rows);
  const currentTotal = sorted.length;
  if (opts.newTotal === currentTotal) return { toDelete: [], toInsert: [], toUpdate: [] };
  if (opts.newTotal < 1) throw new Error('newTotal deve ser >= 1');
  if (sorted.length === 0 || !sorted[0].billing_month) {
    throw new Error('grupo vazio ou sem billing_month');
  }

  const baseDesc = stripInstallmentSuffix(sorted[0].description);
  const newEndBilling = addMonthsToISO(sorted[0].billing_month, opts.newTotal - 1);

  if (opts.newTotal < currentTotal) {
    const toDelete = sorted.slice(opts.newTotal).map((r) => r.id);
    const toUpdate: RowPatch[] = sorted.slice(0, opts.newTotal).map((r) => ({
      id: r.id,
      patch: {
        total_installments: opts.newTotal,
        installment_end_date: newEndBilling,
        description: withInstallmentSuffix(baseDesc, r.installment_number ?? 0, opts.newTotal),
      },
    }));
    return { toDelete, toInsert: [], toUpdate };
  }

  const sample = sorted[0];
  const lastBilling = sorted[sorted.length - 1].billing_month;
  if (!lastBilling) throw new Error('última parcela sem billing_month');
  const perAmount = Math.abs(Number(sample.amount));

  const toInsert: InstallmentRow[] = [];
  for (let i = currentTotal; i < opts.newTotal; i++) {
    toInsert.push({
      user_id: sample.user_id,
      description: withInstallmentSuffix(baseDesc, i + 1, opts.newTotal),
      amount: -perAmount,
      type: 'expense',
      payment_method: sample.payment_method,
      category: sample.category,
      notes: sample.notes,
      expense_month: sample.expense_month ?? toISODate(firstDayOfMonth(new Date(sample.transaction_date))),
      billing_month: addMonthsToISO(lastBilling, i + 1 - currentTotal),
      card_id: sample.card_id,
      is_recurring: sample.is_recurring,
      is_paid: false,
      transaction_date: sample.transaction_date,
      is_installment: true,
      installment_number: i + 1,
      total_installments: opts.newTotal,
      installment_group_id: sample.installment_group_id ?? '',
      installment_end_date: newEndBilling,
    });
  }
  const toUpdate: RowPatch[] = sorted.map((r) => ({
    id: r.id,
    patch: {
      total_installments: opts.newTotal,
      installment_end_date: newEndBilling,
      description: withInstallmentSuffix(baseDesc, r.installment_number ?? 0, opts.newTotal),
    },
  }));
  return { toDelete: [], toInsert, toUpdate };
}

/**
 * Reagenda o grupo deslocando billing_month em N meses.
 *
 * Por padrão não mexe em parcelas pagas. O `installment_end_date` é
 * recalculado com base no maior billing_month do grupo após o shift.
 */
export function groupReschedule(opts: {
  rows: GroupRow[];
  shiftMonths: number;
  includePaid: boolean;
}): { toUpdate: RowPatch[] } {
  if (opts.shiftMonths === 0) return { toUpdate: [] };
  const sorted = sortByNumber(opts.rows);

  const projected = sorted.map((r) => {
    const shouldShift = opts.includePaid || !r.is_paid;
    const newBilling =
      shouldShift && r.billing_month
        ? addMonthsToISO(r.billing_month, opts.shiftMonths)
        : r.billing_month;
    return { id: r.id, oldBilling: r.billing_month, newBilling, oldEnd: r.installment_end_date };
  });

  const newEnd = projected.reduce<string>((max, p) => {
    if (!p.newBilling) return max;
    return p.newBilling > max ? p.newBilling : max;
  }, '');

  const toUpdate: RowPatch[] = [];
  for (const p of projected) {
    const billingChanged = p.newBilling !== p.oldBilling;
    const endChanged = newEnd && p.oldEnd !== newEnd;
    if (!billingChanged && !endChanged) continue;
    const patch: Partial<GroupRow> = {};
    if (billingChanged) patch.billing_month = p.newBilling;
    if (endChanged) patch.installment_end_date = newEnd;
    toUpdate.push({ id: p.id, patch });
  }
  return { toUpdate };
}

/** Atualiza o valor por parcela (filtra por pagas conforme includePaid). */
export function groupBulkValue(opts: {
  rows: GroupRow[];
  newAmount: number;
  includePaid: boolean;
}): { toUpdate: RowPatch[] } {
  if (opts.newAmount <= 0) throw new Error('newAmount deve ser > 0');
  const toUpdate = opts.rows
    .filter((r) => opts.includePaid || !r.is_paid)
    .map((r) => ({ id: r.id, patch: { amount: -Math.abs(opts.newAmount) } as Partial<GroupRow> }));
  return { toUpdate };
}

/**
 * Atualiza campos compartilhados (descrição, categoria, método, cartão) em
 * todas as parcelas filtradas. Descrição preserva o sufixo (N/M).
 */
export function groupBulkFields(opts: {
  rows: GroupRow[];
  fields: {
    description?: string;
    category?: string;
    payment_method?: 'credit' | 'debit' | 'pix' | 'cash';
    card_id?: string | null;
  };
  includePaid: boolean;
}): { toUpdate: RowPatch[] } {
  const hasAny =
    opts.fields.description !== undefined ||
    opts.fields.category !== undefined ||
    opts.fields.payment_method !== undefined ||
    opts.fields.card_id !== undefined;
  if (!hasAny) return { toUpdate: [] };

  const toUpdate: RowPatch[] = opts.rows
    .filter((r) => opts.includePaid || !r.is_paid)
    .map((r) => {
      const patch: Partial<GroupRow> = {};
      if (opts.fields.description !== undefined) {
        patch.description = withInstallmentSuffix(
          opts.fields.description,
          r.installment_number ?? 0,
          r.total_installments ?? 0,
        );
      }
      if (opts.fields.category !== undefined) patch.category = opts.fields.category;
      if (opts.fields.payment_method !== undefined) patch.payment_method = opts.fields.payment_method;
      if (opts.fields.card_id !== undefined) patch.card_id = opts.fields.card_id;
      return { id: r.id, patch };
    });
  return { toUpdate };
}
