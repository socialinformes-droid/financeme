export const CATEGORIES = [
  'Salário',
  'Freela',
  'Reembolso',
  'Cartão',
  'Assinatura',
  'Família',
  'Saúde',
  'Cuidados',
  'Transporte',
  'Recargas',
  'Impostos',
  'Alimentação',
  'Moradia',
  'Lazer',
  'Manual',
  'Outros',
] as const;

export type Category = (typeof CATEGORIES)[number];

// Paleta editorial — tons terrosos, profundos, sem neon
export const CATEGORY_COLOR: Record<Category, string> = {
  'Salário':     '#5a7d4f', // forest
  'Freela':      '#7a9a5a', // verde-claro
  'Reembolso':   '#5a8a8a', // verde-azulado
  'Cartão':      '#6b4f7a', // plum
  'Assinatura':  '#3f7a7a', // teal
  'Família':     '#b76e54', // terracota
  'Saúde':       '#a84e3e', // rust
  'Cuidados':    '#a85e7a', // rose-velho
  'Transporte':  '#4e6e8e', // azul-aço
  'Recargas':    '#5e6e8e', // azul-acinzentado
  'Impostos':    '#7a7268', // taupe
  'Alimentação': '#a8862e', // mostarda
  'Moradia':     '#6e7a4e', // oliva
  'Lazer':       '#7a5a9a', // ametista
  'Manual':      '#5a5e68', // grafite
  'Outros':      '#8a8580', // cinza-claro
};
