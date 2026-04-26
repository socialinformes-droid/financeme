/**
 * Resolve o ano selecionado a partir do searchParams + busca anos disponíveis no DB.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export async function getAvailableYears(
  supabase: SupabaseClient<Database>,
): Promise<number[]> {
  const { data } = await supabase
    .from('transactions')
    .select('expense_month')
    .not('expense_month', 'is', null);
  const years = new Set<number>();
  for (const row of data ?? []) {
    if (!row.expense_month) continue;
    const y = Number(row.expense_month.slice(0, 4));
    if (Number.isFinite(y)) years.add(y);
  }
  // Sempre inclui o ano atual
  years.add(new Date().getFullYear());
  return [...years].sort();
}

export function resolveYear(
  searchParam: string | string[] | undefined,
  fallback?: number,
): number {
  const v = Array.isArray(searchParam) ? searchParam[0] : searchParam;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 2000 && n <= 2100) return n;
  return fallback ?? new Date().getFullYear();
}
