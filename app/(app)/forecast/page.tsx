import { createClient } from '@/lib/supabase/server';
import { resolveYear } from '@/lib/domain/years';
import {
  formatBRL,
  formatMonthBR,
  toISODate,
  firstDayOfMonth,
} from '@/lib/format';
import type { TransactionRow, RecurringIncomeRow } from '@/lib/supabase/types';
import { ForecastView } from './_view';

export const dynamic = 'force-dynamic';

export type ForecastMonth = {
  month: string;          // YYYY-MM-01
  isPast: boolean;
  isCurrent: boolean;
  // Realizado (passado/atual)
  realIncome: number;
  realExpense: number;
  // Projetado (futuro)
  recurringIncome: number;
  recurringExpense: number;
  installments: number;
  variableEstimate: number;
};

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { year: yearParam } = await searchParams;
  const year = resolveYear(yearParam);
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year + 1}-01-01`;
  const todayKey = toISODate(firstDayOfMonth(new Date()));

  const [{ data: txs }, { data: recurring }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .gte('expense_month', `${year - 1}-01-01`)
      .lt('expense_month', endOfYear)
      .order('expense_month', { ascending: true }),
    supabase.from('recurring_income').select('*').eq('is_active', true),
  ]);

  const allTxs = (txs ?? []) as TransactionRow[];
  const recurringIncomes = (recurring ?? []) as RecurringIncomeRow[];

  // Renda recorrente declarada no DB (soma diária)
  const recurringIncomeMonth = recurringIncomes.reduce((a, r) => a + Number(r.amount), 0);

  // Despesas recorrentes (is_recurring=true em transactions): tira média do últimos 6m com expense_month antes de hoje
  const sixMonthsAgo = todayKey;
  const recurringExpensesPast = allTxs.filter(
    (t) =>
      t.is_recurring &&
      t.type === 'expense' &&
      (t.expense_month ?? '') < sixMonthsAgo,
  );
  // soma a média mensal das recorrentes presentes nos últimos 6 meses
  const recurringExpenseMap = new Map<string, number[]>();
  for (const t of recurringExpensesPast) {
    const key = t.description;
    const arr = recurringExpenseMap.get(key) ?? [];
    arr.push(Math.abs(Number(t.amount)));
    recurringExpenseMap.set(key, arr);
  }
  const recurringExpenseMonth = [...recurringExpenseMap.values()].reduce(
    (a, vals) => a + vals.reduce((b, v) => b + v, 0) / vals.length,
    0,
  );

  // Variável: média dos últimos 3 meses de saídas não-recorrentes e não-installment
  const last3Months: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(todayKey);
    d.setMonth(d.getMonth() - i);
    last3Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
  }
  const variablePast = allTxs.filter(
    (t) =>
      t.type === 'expense' &&
      !t.is_recurring &&
      !t.is_installment &&
      last3Months.includes(t.expense_month ?? ''),
  );
  const variableTotal = variablePast.reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
  const variableEstimateMonth = variablePast.length > 0 ? variableTotal / 3 : 0;

  // Constrói os 12 meses do ano
  const months: ForecastMonth[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}-01`;
    const monthTxs = allTxs.filter((t) => t.expense_month === monthKey);
    const isPast = monthKey < todayKey;
    const isCurrent = monthKey === todayKey;
    const realIncome = monthTxs.filter((t) => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0);
    const realExpense = monthTxs.filter((t) => t.type === 'expense').reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
    // Parcelas (installments) projetadas — aquelas com billing_month=monthKey, mesmo no futuro
    const installmentsForMonth = allTxs
      .filter((t) => t.is_installment && t.billing_month === monthKey)
      .reduce((a, t) => a + Math.abs(Number(t.amount)), 0);

    months.push({
      month: monthKey,
      isPast,
      isCurrent,
      realIncome,
      realExpense,
      recurringIncome: isPast || isCurrent ? 0 : recurringIncomeMonth,
      recurringExpense: isPast || isCurrent ? 0 : recurringExpenseMonth,
      installments: installmentsForMonth,
      variableEstimate: isPast || isCurrent ? 0 : variableEstimateMonth,
    });
  }

  return (
    <ForecastView
      year={year}
      months={months}
      recurringIncomeMonth={recurringIncomeMonth}
      recurringExpenseMonth={recurringExpenseMonth}
      variableEstimateMonth={variableEstimateMonth}
    />
  );
}
