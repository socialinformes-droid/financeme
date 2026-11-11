import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Cada tela que SOMA valores de `transactions` precisa filtrar previstos na query.
// Valor = quantas consultas a `transactions` o arquivo faz.
const SUM_SITES: Record<string, number> = {
  'app/(app)/dashboard/page.tsx': 2,
  'app/(app)/cashflow/page.tsx': 1,
  'app/(app)/cards/page.tsx': 1,
  'app/(app)/installments/page.tsx': 2,
  'app/(app)/shopping/page.tsx': 1,
  'components/cards/extrato-comparativo.tsx': 1,
};

describe('filtro is_active nas telas que somam', () => {
  for (const [file, queries] of Object.entries(SUM_SITES)) {
    it(`${file} filtra previstos em ${queries} consulta(s)`, () => {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      const reads = (src.match(/\.from\('transactions'\)/g) ?? []).length;
      const filters = (src.match(/\.eq\('is_active', true\)/g) ?? []).length;
      expect(reads).toBe(queries);
      expect(filters).toBeGreaterThanOrEqual(queries);
    });
  }
});
