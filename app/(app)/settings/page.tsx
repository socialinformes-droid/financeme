import { createClient } from '@/lib/supabase/server';
import type {
  RecurringIncomeRow,
  BudgetRow,
  CategoryRow,
} from '@/lib/supabase/types';
import { SettingsView } from './_view';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: incomes }, { data: budgets }, { data: txCount }, { data: categories }] =
    await Promise.all([
      supabase
        .from('recurring_income')
        .select('*')
        .order('description', { ascending: true }),
      supabase.from('budgets').select('*').order('month', { ascending: false }),
      supabase.from('transactions').select('id', { count: 'exact', head: true }),
      supabase.from('categories').select('*').order('name', { ascending: true }),
    ]);

  return (
    <SettingsView
      userId={user.id}
      incomes={(incomes ?? []) as RecurringIncomeRow[]}
      budgets={(budgets ?? []) as BudgetRow[]}
      categories={(categories ?? []) as CategoryRow[]}
      transactionCount={(txCount as unknown as { count: number } | null)?.count ?? 0}
    />
  );
}
