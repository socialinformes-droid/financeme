import { createClient } from '@/lib/supabase/server';
import { resolveYear } from '@/lib/domain/years';
import {
  toISODate,
  firstDayOfMonth,
  addMonthsToISO,
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
  projectedIncome: number;
  projectedFixed: number;       // parcelas (installments)
  projectedVariable: number;    // média 3m das saídas restantes
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

  // Pega todas as transações do ano + 6 meses antes (pra calcular médias)
  const lookbackStart = addMonthsToISO(startOfYear, -6);

  const [{ data: txs }, { data: recurring }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .gte('expense_month', lookbackStart)
      .lt('expense_month', endOfYear)
      .order('expense_month', { ascending: true }),
    supabase.from('recurring_income').select('*').eq('is_active', true),
  ]);

  const allTxs = (txs ?? []) as TransactionRow[];
  const recurringIncomes = (recurring ?? []) as RecurringIncomeRow[];

  // ─────────────────────────────────────────────────────────────────────────
  // Cálculos baseados em DADOS REAIS, sem depender de flag is_recurring
  // ─────────────────────────────────────────────────────────────────────────

  // 1) Renda projetada/mês = média 3 meses anteriores ao current de TODAS entradas reais.
  //    Fallback: recurring_income declarada (Salário) se não houver histórico.
  const last3RealMonths: string[] = [];
  for (let i = 1; i <= 3; i++) {
    last3RealMonths.push(addMonthsToISO(todayKey, -i));
  }

  const realIncome3m = last3RealMonths.map((m) => {
    return allTxs
      .filter((t) => t.expense_month === m && t.type === 'income')
      .reduce((a, t) => a + Number(t.amount), 0);
  });
  const incomeAvg = realIncome3m.length > 0
    ? realIncome3m.reduce((a, b) => a + b, 0) / realIncome3m.length
    : 0;

  const declaredIncome = recurringIncomes.reduce((a, r) => a + Number(r.amount), 0);

  // Usa o maior entre média histórica e renda declarada (mais conservador)
  const projectedIncomeMonth = Math.max(incomeAvg, declaredIncome);

  // 2) Saídas projetadas/mês = média 3m de TODAS as saídas reais EXCLUINDO parcelas
  //    (parcelas são contadas separadamente e exatas)
  const realExpenseExcludingInstallments3m = last3RealMonths.map((m) => {
    return allTxs
      .filter(
        (t) =>
          t.expense_month === m &&
          t.type === 'expense' &&
          !t.is_installment,
      )
      .reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
  });
  const variableEstimateMonth = realExpenseExcludingInstallments3m.length > 0
    ? realExpenseExcludingInstallments3m.reduce((a, b) => a + b, 0) /
      realExpenseExcludingInstallments3m.length
    : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Constrói os 12 meses do ano
  // ─────────────────────────────────────────────────────────────────────────
  const months: ForecastMonth[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthKey = `${year}-${String(m).padStart(2, '0')}-01`;
    const monthTxs = allTxs.filter((t) => t.expense_month === monthKey);
    const isPast = monthKey < todayKey;
    const isCurrent = monthKey === todayKey;

    const realIncome = monthTxs
      .filter((t) => t.type === 'income')
      .reduce((a, t) => a + Number(t.amount), 0);
    const realExpense = monthTxs
      .filter((t) => t.type === 'expense')
      .reduce((a, t) => a + Math.abs(Number(t.amount)), 0);

    // Parcelas projetadas = instalments com billing_month neste mês
    const installmentsForMonth = allTxs
      .filter((t) => t.is_installment && t.billing_month === monthKey)
      .reduce((a, t) => a + Math.abs(Number(t.amount)), 0);

    const isFuture = !isPast && !isCurrent;

    months.push({
      month: monthKey,
      isPast,
      isCurrent,
      realIncome,
      realExpense,
      projectedIncome: isFuture ? projectedIncomeMonth : 0,
      projectedFixed: isFuture ? installmentsForMonth : 0,
      projectedVariable: isFuture ? variableEstimateMonth : 0,
    });
  }

  return (
    <ForecastView
      year={year}
      months={months}
      projectedIncomeMonth={projectedIncomeMonth}
      variableEstimateMonth={variableEstimateMonth}
      declaredIncome={declaredIncome}
      incomeAvg={incomeAvg}
    />
  );
}
