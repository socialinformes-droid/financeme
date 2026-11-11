import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Cada tela que SOMA valores de `transactions` precisa filtrar previstos em CADA consulta.
// Valor = quantas consultas a `transactions` o arquivo faz.
const SUM_SITES: Record<string, number> = {
  'app/(app)/dashboard/page.tsx': 2,
  'app/(app)/cashflow/page.tsx': 1,
  'app/(app)/cards/page.tsx': 1,
  'app/(app)/installments/page.tsx': 2,
  'app/(app)/shopping/page.tsx': 1,
  'components/cards/extrato-comparativo.tsx': 1,
};

const FILTER = ".eq('is_active', true)";

// Remove comentários `/* */` e `//` (este último sem casar `https://`).
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<![:\w])\/\/[^\n]*/g, '');
}

// Cada chain de transactions é o texto entre `.from('transactions')` e o PRÓXIMO `.from(`
// (ou fim do arquivo). Assim o filtro de um `.from('categories')` posterior nunca é contado.
function transactionChains(src: string): string[] {
  const parts = stripComments(src).split('.from(');
  return parts.slice(1).filter((part) => part.startsWith("'transactions')"));
}

describe('filtro is_active nas telas que somam', () => {
  for (const [file, queries] of Object.entries(SUM_SITES)) {
    it(`${file} filtra previstos em cada uma das ${queries} consulta(s) a transactions`, () => {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      const chains = transactionChains(src);
      expect(chains).toHaveLength(queries);
      expect(chains.map((chain) => chain.includes(FILTER))).toEqual(chains.map(() => true));
    });
  }
});
