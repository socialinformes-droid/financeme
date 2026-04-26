import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { SEED_TRANSACTIONS } from '@/lib/seed-data';

type SB = SupabaseClient<Database>;

export type SeedResult = {
  skipped: boolean;
  recurringIncome: number;
  transactions: number;
  shoppingItems: number;
};

/**
 * Idempotente: só roda se `recurring_income` do usuário estiver vazia.
 * Popula com os 137 lançamentos reais da planilha 2026 + lista de compras.
 */
export async function seedInitialData(supabase: SB, userId: string): Promise<SeedResult> {
  const { count, error: countError } = await supabase
    .from('recurring_income')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    return { skipped: true, recurringIncome: 0, transactions: 0, shoppingItems: 0 };
  }

  // 1) Renda recorrente — declarativa (o histórico real está nas transactions)
  const { error: incomeError } = await supabase.from('recurring_income').insert({
    user_id: userId,
    description: 'Salário',
    amount: 3425,
    day_of_month: 5,
    is_active: true,
  });
  if (incomeError) throw incomeError;

  // 2) Transações da planilha (137 linhas, jan/26 → jan/27)
  type TxInsert = Database['public']['Tables']['transactions']['Insert'];
  const txRows: TxInsert[] = SEED_TRANSACTIONS.map((t) => ({
    user_id: userId,
    description: t.description,
    amount: t.amount,
    type: t.type,
    payment_method: t.payment_method,
    category: t.category,
    notes: null,
    expense_month: t.expense_month,
    billing_month: t.billing_month,
    card_id: null,
    is_recurring: false,
    is_paid: t.is_paid,
    transaction_date: t.transaction_date,
    is_installment: false,
    installment_number: null,
    total_installments: null,
    installment_group_id: null,
    installment_end_date: null,
  }));

  // Insert em lotes de 50 pra não estourar payload
  for (let i = 0; i < txRows.length; i += 50) {
    const batch = txRows.slice(i, i + 50);
    const { error } = await supabase.from('transactions').insert(batch);
    if (error) throw error;
  }

  // Marca padrões repetidos como parcelas (Dentista, Manual)
  // — a planilha não tem essa metadata, mas semanticamente são compras parceladas.
  const INSTALLMENT_PATTERNS = ['Dentista', 'Manual'];
  for (const desc of INSTALLMENT_PATTERNS) {
    const { data: rows, error: fetchErr } = await supabase
      .from('transactions')
      .select('id, billing_month')
      .eq('user_id', userId)
      .eq('description', desc)
      .order('expense_month', { ascending: true });
    if (fetchErr) throw fetchErr;
    if (!rows || rows.length < 2) continue;
    const groupId = crypto.randomUUID();
    const total = rows.length;
    const endDate = rows[rows.length - 1].billing_month;
    for (let i = 0; i < rows.length; i++) {
      const { error: updErr } = await supabase
        .from('transactions')
        .update({
          is_installment: true,
          installment_number: i + 1,
          total_installments: total,
          installment_group_id: groupId,
          installment_end_date: endDate,
        })
        .eq('id', rows[i].id);
      if (updErr) throw updErr;
    }
  }

  // 3) Lista de compras (20 itens)
  type ShoppingInsert = Database['public']['Tables']['shopping_list']['Insert'];
  const shoppingItems: ShoppingInsert[] = (
    [
      { name: '2x Calça Jeans', quantity: 2, price_min: 110, price_max: 200, category: 'Roupas', store_name: 'Netshoes/Shopee', priority: 'medium' },
      { name: 'Sapato Branco', quantity: 1, price_min: 120, price_max: 280, category: 'Roupas', store_name: 'Mercado Livre', priority: 'medium' },
      { name: 'Ar-Condicionado Split 9.000 BTU', quantity: 1, price_min: 1400, price_max: 2400, category: 'Eletrodoméstico', store_name: 'Magazine Luiza/Casas Bahia', priority: 'high' },
      { name: 'Esteira de Corrida', quantity: 1, price_min: 1500, price_max: 3000, category: 'Fitness', store_name: 'Mercado Livre', priority: 'medium' },
      { name: 'Barbeador Elétrico', quantity: 1, price_min: 60, price_max: 250, category: 'Cuidados', store_name: 'Amazon', priority: 'medium' },
      { name: 'Corrente de Prata', quantity: 1, price_min: 150, price_max: 450, category: 'Acessórios', store_name: 'Prata & Cia', priority: 'low' },
      { name: 'Teclado (Mecânico)', quantity: 1, price_min: 80, price_max: 300, category: 'Tecnologia', store_name: 'Amazon/KaBuM', priority: 'medium' },
      { name: 'Resma de Papel A4', quantity: 1, price_min: 28, price_max: 50, category: 'Papelaria', store_name: 'Shopee', priority: 'low' },
      { name: 'Dentista (tratamento)', quantity: 1, price_min: 150, price_max: 350, category: 'Saúde', priority: 'high', notes: 'Já lançado em parcelas mensais de R$110' },
      { name: 'Skincare (kit básico)', quantity: 1, price_min: 120, price_max: 350, category: 'Cuidados', store_name: 'Shopee', priority: 'medium' },
      { name: 'Organizador de Gaveta', quantity: 1, price_min: 30, price_max: 90, category: 'Casa', store_name: 'Shopee', priority: 'low' },
      { name: '2x Shorts', quantity: 2, price_min: 60, price_max: 140, category: 'Roupas', store_name: 'Shopee', priority: 'medium' },
      { name: 'Sandália Preta', quantity: 1, price_min: 80, price_max: 200, category: 'Roupas', store_name: 'Shein/Shopee', priority: 'medium' },
      { name: 'Mala de Viagem', quantity: 1, price_min: 180, price_max: 500, category: 'Casa', store_name: 'Mercado Livre', priority: 'low' },
      { name: 'Kit Barba Presto', quantity: 1, price_min: 40, price_max: 120, category: 'Cuidados', store_name: 'Amazon', priority: 'medium' },
      { name: 'Película Tablet', quantity: 1, price_min: 20, price_max: 60, category: 'Tecnologia', store_name: 'Shopee', priority: 'high' },
      { name: 'Ponta Caneta Tablet', quantity: 1, price_min: 30, price_max: 90, category: 'Tecnologia', store_name: 'Shopee', priority: 'high' },
      { name: 'iPhone 14 Pro Max (seminovo)', quantity: 1, price_min: 3500, price_max: 6000, category: 'Tecnologia', store_name: 'Mercado Livre', priority: 'medium', reference_url: 'https://lista.mercadolivre.com.br/iphone-14-pro-max' },
      { name: 'Fita LED 10 metros', quantity: 1, price_min: 30, price_max: 80, category: 'Casa', store_name: 'Shopee', priority: 'low' },
      { name: 'Echo Pop (Amazon)', quantity: 1, price_min: 250, price_max: 350, category: 'Tecnologia', store_name: 'Amazon', priority: 'low', reference_url: 'https://www.amazon.com.br/echo-pop/s?k=echo+pop' },
    ] as Array<Partial<ShoppingInsert> & { name: string; quantity: number; priority: 'low' | 'medium' | 'high' }>
  ).map((it) => ({
    user_id: userId,
    name: it.name,
    quantity: it.quantity,
    price_min: it.price_min ?? null,
    price_max: it.price_max ?? null,
    reference_url: it.reference_url ?? null,
    store_name: it.store_name ?? null,
    category: it.category ?? null,
    priority: it.priority,
    planned_month: null,
    is_purchased: false,
    purchased_price: null,
    notes: it.notes ?? null,
  }));

  const { error: shoppingError } = await supabase.from('shopping_list').insert(shoppingItems);
  if (shoppingError) throw shoppingError;

  return {
    skipped: false,
    recurringIncome: 1,
    transactions: txRows.length,
    shoppingItems: shoppingItems.length,
  };
}
