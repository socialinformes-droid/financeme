import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CardRow } from '@/lib/supabase/types';

type SB = SupabaseClient<Database>;

/**
 * Garante que existem placeholders Cartão (amount=0) pra cada cartão ativo × cada mês do ano.
 *
 * Por que: o user precisa "ver" as 12 faturas no /cards e no dashboard mesmo antes de ter
 * recebido o extrato. Sem placeholder, a célula da FaturaGrid está vazia mas vinculada a
 * uma row que não existe — e o user não consegue editar/listar a fatura por outras vias.
 *
 * Política: idempotente. Chamada toda vez que o user abre /cards?year=N. Insere só o que falta.
 *
 * Os placeholders saem da listagem em /transactions via filtro `category != 'Cartão' OR amount != 0`.
 * No FaturaGrid e no dashboard pivot eles aparecem como "—" (zero), prontos pra editar.
 */
export async function ensureCardFaturasForYear(
  supabase: SB,
  userId: string,
  year: number,
  cards: CardRow[],
): Promise<void> {
  if (cards.length === 0) return;

  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year + 1}-01-01`;

  const { data: existing } = await supabase
    .from('transactions')
    .select('card_id,billing_month')
    .eq('user_id', userId)
    .eq('category', 'Cartão')
    .gte('billing_month', startOfYear)
    .lt('billing_month', endOfYear);

  const existingSet = new Set(
    (existing ?? [])
      .filter((r): r is { card_id: string; billing_month: string } => !!r.card_id && !!r.billing_month)
      .map((r) => `${r.card_id}|${r.billing_month}`),
  );

  type Insert = Database['public']['Tables']['transactions']['Insert'];
  const inserts: Insert[] = [];
  for (const card of cards) {
    for (let m = 1; m <= 12; m++) {
      const billing = `${year}-${String(m).padStart(2, '0')}-01`;
      if (existingSet.has(`${card.id}|${billing}`)) continue;
      inserts.push({
        user_id: userId,
        description: `Cartão ${card.name}`,
        amount: 0,
        type: 'expense',
        payment_method: 'debit',
        category: 'Cartão',
        notes: null,
        expense_month: billing,
        billing_month: billing,
        card_id: card.id,
        is_recurring: false,
        is_paid: false,
        transaction_date: billing,
        is_installment: false,
        installment_number: null,
        total_installments: null,
        installment_group_id: null,
        installment_end_date: null,
      });
    }
  }

  if (inserts.length === 0) return;
  const { error } = await supabase.from('transactions').insert(inserts);
  if (error) {
    console.error('[ensureCardFaturasForYear] failed:', error);
  }
}
