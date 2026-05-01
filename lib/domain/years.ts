/**
 * Resolve o ano selecionado a partir do searchParams + busca anos disponíveis no DB.
 * Persiste o ano selecionado em cookie pra UX "sticky" — selecionou 2027 uma vez,
 * todas as páginas seguintes assumem 2027 mesmo se a URL não tiver ?year=.
 */
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

export const SELECTED_YEAR_COOKIE = 'selected_year';

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

function parseYear(v: string | string[] | undefined | null): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  const n = Number(s);
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? n : null;
}

/**
 * Resolução prioritizada: searchParam → cookie → ano atual.
 * Server-only: usa next/headers cookies(). Use nas pages app/(app)/.../page.tsx.
 */
export async function resolveYearWithCookie(
  searchParam: string | string[] | undefined,
): Promise<number> {
  const fromParam = parseYear(searchParam);
  if (fromParam !== null) return fromParam;
  const c = await cookies();
  const fromCookie = parseYear(c.get(SELECTED_YEAR_COOKIE)?.value);
  if (fromCookie !== null) return fromCookie;
  return new Date().getFullYear();
}

/** @deprecated Use resolveYearWithCookie pra suportar persistência via cookie. */
export function resolveYear(
  searchParam: string | string[] | undefined,
  fallback?: number,
): number {
  const fromParam = parseYear(searchParam);
  if (fromParam !== null) return fromParam;
  return fallback ?? new Date().getFullYear();
}
