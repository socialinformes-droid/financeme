/**
 * Mapeia nome de comerciante (merchant) para categoria do Financeme
 * Usa padrões de matching para categorizar automaticamente
 */

type MerchantPattern = {
  keywords: string[];
  category: string;
};

const MERCHANT_PATTERNS: MerchantPattern[] = [
  // Alimentação
  {
    keywords: ['padaria', 'padeiro', 'pão', 'bakery', 'doces', 'confeitaria'],
    category: 'Alimentação',
  },
  {
    keywords: ['restaurante', 'resto', 'pizza', 'churrasco', 'churrascaria', 'lanchonete'],
    category: 'Alimentação',
  },
  {
    keywords: ['mercado', 'supermercado', 'super', 'açougue', 'feira'],
    category: 'Alimentação',
  },
  {
    keywords: ['café', 'coffee', 'cappuccino', 'bar', 'boteco', 'pub'],
    category: 'Alimentação',
  },
  {
    keywords: ['delivery', 'ifood', 'rappi', 'uber eats'],
    category: 'Alimentação',
  },

  // Transporte
  {
    keywords: ['uber', 'lyft', 'taxi', 'táxi', '99', 'táxis'],
    category: 'Transporte',
  },
  {
    keywords: ['passagem', 'ônibus', 'bus', 'metro', 'trem', 'ferroviária'],
    category: 'Transporte',
  },
  {
    keywords: ['gasolina', 'combustível', 'posto', 'shell', 'br', 'petrobras', 'ipiranga'],
    category: 'Transporte',
  },
  {
    keywords: ['estacionamento', 'parking'],
    category: 'Transporte',
  },

  // Saúde
  {
    keywords: ['farmácia', 'farmacia', 'pharmacy', 'drogaria', 'droga'],
    category: 'Saúde',
  },
  {
    keywords: ['médico', 'medico', 'doctor', 'clínica', 'clinica', 'hospital', 'consultório'],
    category: 'Saúde',
  },
  {
    keywords: ['dentista', 'odonto', 'dental'],
    category: 'Saúde',
  },
  {
    keywords: ['academia', 'musculação', 'gym', 'fitness', 'pilates', 'yoga'],
    category: 'Saúde',
  },

  // Educação
  {
    keywords: ['curso', 'escola', 'universidade', 'faculdade', 'univ', 'educação'],
    category: 'Educação',
  },
  {
    keywords: ['udemy', 'coursera', 'linkedin learning', 'alura'],
    category: 'Educação',
  },

  // Lazer
  {
    keywords: ['cinema', 'teatro', 'show', 'museu', 'parque', 'ingresso'],
    category: 'Lazer',
  },
  {
    keywords: ['netflix', 'spotify', 'disney', 'prime video', 'hbo', 'steam', 'playstation'],
    category: 'Lazer',
  },
  {
    keywords: ['game', 'jogo', 'xbox', 'nintendo'],
    category: 'Lazer',
  },

  // Moradia
  {
    keywords: ['aluguel', 'rent', 'condomínio', 'condominio', 'sindico'],
    category: 'Moradia',
  },
  {
    keywords: ['água', 'gás', 'eletricidade', 'luz', 'energia', 'sabesp', 'cesp'],
    category: 'Moradia',
  },
  {
    keywords: ['internet', 'telefone', 'celular', 'móvel', 'vivo', 'claro', 'oi', 'tim'],
    category: 'Moradia',
  },

  // Assinatura/Serviços
  {
    keywords: ['assinatura', 'subscription', 'plano', 'mensalidade'],
    category: 'Assinatura',
  },

  // Cuidados pessoais
  {
    keywords: ['salão', 'cabelo', 'cabeleireiro', 'corte', 'manicure', 'pedicure', 'barba'],
    category: 'Cuidados',
  },
  {
    keywords: ['cosméticos', 'cosmético', 'perfume', 'beleza'],
    category: 'Cuidados',
  },

  // Vestuário
  {
    keywords: ['roupa', 'calçado', 'sapato', 'loja', 'shopping', 'moda', 'fashion'],
    category: 'Lazer',
  },

  // Recargas
  {
    keywords: ['recarga', 'vale transporte', 'vt', 'vale refeição', 'vr'],
    category: 'Recargas',
  },
];

/**
 * Mapeia um nome de comerciante para uma categoria
 * Usa busca case-insensitive e keywords
 */
export function mapMerchantToCategory(merchant: string): string {
  const lowerMerchant = merchant.toLowerCase().trim();

  // Procurar por padrões
  for (const pattern of MERCHANT_PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (lowerMerchant.includes(keyword.toLowerCase())) {
        return pattern.category;
      }
    }
  }

  // Fallback: se não encontrou, usa "Outros"
  return 'Outros';
}

/**
 * Sugere categorias baseado em um partial match
 * Útil para UI que oferece sugestões
 */
export function suggestCategories(
  merchant: string,
  limit = 3
): Array<{ category: string; confidence: number }> {
  const lowerMerchant = merchant.toLowerCase().trim();
  const scores: Map<string, number> = new Map();

  for (const pattern of MERCHANT_PATTERNS) {
    for (const keyword of pattern.keywords) {
      const distance = calculateSimilarity(lowerMerchant, keyword.toLowerCase());
      if (distance > 0.5) {
        const current = scores.get(pattern.category) || 0;
        scores.set(pattern.category, Math.max(current, distance));
      }
    }
  }

  return Array.from(scores.entries())
    .map(([category, confidence]) => ({ category, confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/**
 * Calcula similaridade entre dois strings (0 a 1)
 * Usa Levenshtein distance normalizado
 */
function calculateSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;

  if (longer.length === 0) return 1.0;

  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Levenshtein distance (distância de edição)
 */
function getEditDistance(a: string, b: string): number {
  const costs = [];
  for (let i = 0; i <= a.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }
  return costs[b.length];
}
