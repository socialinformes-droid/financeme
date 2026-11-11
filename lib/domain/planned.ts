export type ActiveScope = 'one' | 'forward' | 'group';

export type ScopeRow = {
  id: string;
  installment_group_id: string | null;
  billing_month: string | null;
};

export type AggregatableRow = {
  type: 'income' | 'expense';
  category: string;
  amount: number | string;
  is_active?: boolean | null;
};

export type CategoryTotal = { category: string; value: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Linha sem o campo (ou com null) conta como ativa. */
export function isActive(row: { is_active?: boolean | null }): boolean {
  return row.is_active !== false;
}

/**
 * Agrega despesas por categoria (valor absoluto). Receitas são ignoradas.
 * `activeTotal` e `plannedTotal` somam sempre as duas populações, independente
 * de `includePlanned`, que só controla o que entra em `slices`.
 */
export function aggregateByCategory(
  rows: AggregatableRow[],
  opts: { includePlanned: boolean },
): { slices: CategoryTotal[]; activeTotal: number; plannedTotal: number } {
  const byCategory = new Map<string, number>();
  let activeTotal = 0;
  let plannedTotal = 0;
  for (const r of rows) {
    if (r.type !== 'expense') continue;
    const value = Math.abs(Number(r.amount));
    const active = isActive(r);
    if (active) activeTotal += value;
    else plannedTotal += value;
    if (!active && !opts.includePlanned) continue;
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + value);
  }
  const slices = [...byCategory.entries()]
    .map(([category, value]) => ({ category, value: round2(value) }))
    .sort((a, b) => b.value - a.value);
  return { slices, activeTotal: round2(activeTotal), plannedTotal: round2(plannedTotal) };
}

/**
 * Ids afetados ao ativar/desativar `clicked`.
 * 'forward' usa billing_month (parcelas compartilham transaction_date).
 */
export function resolveScopeIds(rows: ScopeRow[], clicked: ScopeRow, scope: ActiveScope): string[] {
  if (scope === 'one' || !clicked.installment_group_id) return [clicked.id];
  const group = rows.filter((r) => r.installment_group_id === clicked.installment_group_id);
  if (scope === 'group') return group.map((r) => r.id);
  const from = clicked.billing_month ?? '';
  return group.filter((r) => (r.billing_month ?? '') >= from).map((r) => r.id);
}

/** Converte "1.234,56" / "350" / "R$ 90,5" em número. Vazio, texto ou negativo → null. */
export function parseBRLInput(input: string): number | null {
  const cleaned = input.replace(/R\$/g, '').replace(/\s/g, '');
  if (cleaned === '' || cleaned.startsWith('-')) return null;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}
