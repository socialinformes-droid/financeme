import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { createInstallmentTransactions } from '@/lib/domain/installments';

type SB = SupabaseClient<Database>;

export type SeedResult = {
  skipped: boolean;
  recurringIncome: number;
  recurringExpenses: number;
  installments: number;
  shoppingItems: number;
};

/**
 * Idempotente: só roda se `recurring_income` do usuário estiver vazia.
 * Popula os dados reais da planilha 2026 do Felipe.
 */
export async function seedInitialData(supabase: SB, userId: string): Promise<SeedResult> {
  const { count, error: countError } = await supabase
    .from('recurring_income')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    return {
      skipped: true,
      recurringIncome: 0,
      recurringExpenses: 0,
      installments: 0,
      shoppingItems: 0,
    };
  }

  // 1) Salário
  const { error: incomeError } = await supabase.from('recurring_income').insert({
    user_id: userId,
    description: 'Salário',
    amount: 3425,
    day_of_month: 5,
    is_active: true,
  });
  if (incomeError) throw incomeError;

  // 2) Gastos recorrentes (não-parcelados)
  const today = new Date();
  const expenseMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const transactionDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  type TxInsert = Database['public']['Tables']['transactions']['Insert'];

  const recurringExpenses: TxInsert[] = [
    { description: 'Cartão Inter', amount: -610, category: 'Cartão', payment_method: 'debit' },
    { description: 'Mãe', amount: -600, category: 'Família', payment_method: 'pix' },
    { description: 'Netflix', amount: -21, category: 'Assinatura', payment_method: 'credit' },
    { description: 'Crunchyroll', amount: -15, category: 'Assinatura', payment_method: 'credit' },
    { description: 'Spotify', amount: -12, category: 'Assinatura', payment_method: 'credit' },
    { description: 'Claro Flex', amount: -40, category: 'Assinatura', payment_method: 'debit' },
    { description: 'DAS MEI', amount: -86, category: 'Impostos', payment_method: 'debit' },
    { description: 'Barbearia', amount: -25, category: 'Cuidados', payment_method: 'debit' },
  ].map((r) => ({
    user_id: userId,
    description: r.description,
    amount: r.amount,
    type: 'expense',
    payment_method: r.payment_method as 'credit' | 'debit',
    category: r.category,
    notes: null,
    expense_month: expenseMonth,
    billing_month: expenseMonth,
    card_id: null,
    is_recurring: true,
    is_paid: false,
    transaction_date: transactionDate,
    is_installment: false,
    installment_number: null,
    total_installments: null,
    installment_group_id: null,
    installment_end_date: null,
  }));

  if (recurringExpenses.length > 0) {
    const { error: rxError } = await supabase.from('transactions').insert(recurringExpenses);
    if (rxError) throw rxError;
  }

  // 3) Parcelas: dentista 12x R$ 110, jan/2026 → dez/2026
  const dentistRows = createInstallmentTransactions({
    user_id: userId,
    description: 'Dentista',
    totalAmount: 1320,
    installments: 12,
    startDate: new Date(2026, 0, 1),
    category: 'Saúde',
    paymentMethod: 'credit',
    cardId: null,
    card: null,
    notes: 'Tratamento parcelado',
    isRecurring: false,
  });
  const { error: dentistError } = await supabase.from('transactions').insert(dentistRows);
  if (dentistError) throw dentistError;

  // 4) Lista de compras (20 itens)
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
    recurringExpenses: recurringExpenses.length,
    installments: dentistRows.length,
    shoppingItems: shoppingItems.length,
  };
}
