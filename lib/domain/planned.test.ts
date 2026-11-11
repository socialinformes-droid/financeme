import { describe, expect, it } from 'vitest';
import {
  aggregateByCategory,
  isActive,
  parseBRLInput,
  resolveScopeIds,
  type ScopeRow,
} from '@/lib/domain/planned';

describe('isActive', () => {
  it('trata ausência do campo como ativo', () => {
    expect(isActive({})).toBe(true);
    expect(isActive({ is_active: null })).toBe(true);
    expect(isActive({ is_active: true })).toBe(true);
    expect(isActive({ is_active: false })).toBe(false);
  });
});

describe('aggregateByCategory', () => {
  const rows = [
    { type: 'expense' as const, category: 'Moradia', amount: -3000, is_active: true },
    { type: 'expense' as const, category: 'Moradia', amount: -200, is_active: false },
    { type: 'expense' as const, category: 'Mercado', amount: -350, is_active: true },
    { type: 'expense' as const, category: 'Lazer', amount: -900, is_active: false },
    { type: 'income' as const, category: 'Salário', amount: 8000, is_active: true },
  ];

  it('sem previstos soma só ativos e ignora receitas', () => {
    const r = aggregateByCategory(rows, { includePlanned: false });
    expect(r.slices).toEqual([
      { category: 'Moradia', value: 3000 },
      { category: 'Mercado', value: 350 },
    ]);
    expect(r.activeTotal).toBe(3350);
    expect(r.plannedTotal).toBe(1100);
  });

  it('com previstos inclui as categorias só previstas, ordenado do maior pro menor', () => {
    const r = aggregateByCategory(rows, { includePlanned: true });
    expect(r.slices).toEqual([
      { category: 'Moradia', value: 3200 },
      { category: 'Lazer', value: 900 },
      { category: 'Mercado', value: 350 },
    ]);
    expect(r.activeTotal).toBe(3350);
    expect(r.plannedTotal).toBe(1100);
  });

  it('lista vazia devolve zeros', () => {
    expect(aggregateByCategory([], { includePlanned: true })).toEqual({
      slices: [],
      activeTotal: 0,
      plannedTotal: 0,
    });
  });
});

describe('resolveScopeIds', () => {
  const group: ScopeRow[] = [
    { id: 'a', installment_group_id: 'g1', billing_month: '2026-11-01' },
    { id: 'b', installment_group_id: 'g1', billing_month: '2026-12-01' },
    { id: 'c', installment_group_id: 'g1', billing_month: '2027-01-01' },
    { id: 'd', installment_group_id: 'g1', billing_month: '2027-02-01' },
    { id: 'x', installment_group_id: 'g2', billing_month: '2026-12-01' },
  ];
  const clicked = group[1];

  it("'one' devolve só a linha clicada", () => {
    expect(resolveScopeIds(group, clicked, 'one')).toEqual(['b']);
  });
  it("'forward' devolve a clicada e as seguintes do mesmo grupo", () => {
    expect(resolveScopeIds(group, clicked, 'forward')).toEqual(['b', 'c', 'd']);
  });
  it("'group' devolve o grupo todo e nenhuma linha de outro grupo", () => {
    expect(resolveScopeIds(group, clicked, 'group')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('linha sem grupo sempre devolve só ela mesma', () => {
    const solo: ScopeRow = { id: 's', installment_group_id: null, billing_month: '2026-11-01' };
    expect(resolveScopeIds([solo], solo, 'group')).toEqual(['s']);
  });
});

describe('parseBRLInput', () => {
  it('aceita formatos brasileiros e simples', () => {
    expect(parseBRLInput('1.234,56')).toBe(1234.56);
    expect(parseBRLInput('350')).toBe(350);
    expect(parseBRLInput('R$ 90,5')).toBe(90.5);
    expect(parseBRLInput('0')).toBe(0);
  });
  it('rejeita vazio, texto e negativo', () => {
    expect(parseBRLInput('')).toBeNull();
    expect(parseBRLInput('abc')).toBeNull();
    expect(parseBRLInput('-10')).toBeNull();
  });
});
