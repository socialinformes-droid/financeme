/**
 * Categorias agora vivem na tabela `categories` (1 row por user).
 * Esse arquivo guarda apenas:
 *   1. DEFAULT_CATEGORIES — usadas no seed pra novos users
 *   2. Helpers de cor (lookup name → color, com fallback)
 *
 * Pra obter a lista no runtime, use `fetchUserCategories(supabase)` em
 * `lib/domain/categories-fetch.ts`.
 */

export type DefaultCategory = { name: string; color: string };

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: 'Salário',     color: '#5a7d4f' },
  { name: 'Freela',      color: '#7a9a5a' },
  { name: 'Reembolso',   color: '#5a8a8a' },
  { name: 'Cartão',      color: '#6b4f7a' },
  { name: 'Assinatura',  color: '#3f7a7a' },
  { name: 'Família',     color: '#b76e54' },
  { name: 'Saúde',       color: '#a84e3e' },
  { name: 'Cuidados',    color: '#a85e7a' },
  { name: 'Transporte',  color: '#4e6e8e' },
  { name: 'Recargas',    color: '#5e6e8e' },
  { name: 'Educação',    color: '#8a6240' },
  { name: 'Impostos',    color: '#7a7268' },
  { name: 'Alimentação', color: '#a8862e' },
  { name: 'Moradia',     color: '#6e7a4e' },
  { name: 'Lazer',       color: '#7a5a9a' },
  { name: 'Manual',      color: '#5a5e68' },
  { name: 'Outros',      color: '#8a8580' },
];

const FALLBACK_COLOR = '#737373';

/**
 * Lookup name → color baseado numa lista de categorias.
 * Se não achar (categoria histórica que foi deletada), retorna fallback.
 */
export function colorFor(
  categoryName: string,
  categories: ReadonlyArray<{ name: string; color: string | null }>,
): string {
  const found = categories.find((c) => c.name === categoryName);
  if (found?.color) return found.color;
  // Fallback: tenta nas defaults
  const def = DEFAULT_CATEGORIES.find((c) => c.name === categoryName);
  if (def) return def.color;
  return FALLBACK_COLOR;
}

// Compat: alguns componentes ainda usam CATEGORY_COLOR como dict estático.
// Mantemos pra quando não há lista de user disponível (landing page, etc).
export const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORIES.map((c) => [c.name, c.color]),
);

/** @deprecated use fetchUserCategories(supabase) */
export const CATEGORIES = DEFAULT_CATEGORIES.map((c) => c.name);

export type Category = string;
