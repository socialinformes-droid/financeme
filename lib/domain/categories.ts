export const CATEGORIES = [
  'Salário',
  'Cartão',
  'Assinatura',
  'Família',
  'Saúde',
  'Cuidados',
  'Transporte',
  'Impostos',
  'Alimentação',
  'Moradia',
  'Lazer',
  'Manual',
  'Outros',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLOR: Record<Category, string> = {
  'Salário': '#22c55e',
  'Cartão': '#8B5CF6',
  'Assinatura': '#06b6d4',
  'Família': '#f97316',
  'Saúde': '#ef4444',
  'Cuidados': '#ec4899',
  'Transporte': '#0ea5e9',
  'Impostos': '#a3a3a3',
  'Alimentação': '#eab308',
  'Moradia': '#84cc16',
  'Lazer': '#a855f7',
  'Manual': '#64748b',
  'Outros': '#737373',
};
