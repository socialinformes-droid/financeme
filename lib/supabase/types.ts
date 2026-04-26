// Tipagem mínima manual. Substituir por geração automática via:
//   npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts
// quando a CLI estiver configurada.

export type Database = {
  public: {
    Tables: {
      cards: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          brand: string | null;
          limit_amount: number | null;
          closing_day: number | null;
          due_day: number | null;
          color: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['cards']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['cards']['Insert']>;
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          description: string;
          amount: number;
          type: 'income' | 'expense';
          payment_method: 'credit' | 'debit' | 'pix' | 'cash';
          category: string;
          notes: string | null;
          expense_month: string | null;
          billing_month: string | null;
          card_id: string | null;
          is_recurring: boolean;
          is_paid: boolean;
          transaction_date: string;
          is_installment: boolean;
          installment_number: number | null;
          total_installments: number | null;
          installment_group_id: string | null;
          installment_end_date: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['transactions']['Row'],
          'id' | 'created_at'
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
        Relationships: [];
      };
      shopping_list: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          quantity: number;
          price_min: number | null;
          price_max: number | null;
          reference_url: string | null;
          store_name: string | null;
          category: string | null;
          priority: 'low' | 'medium' | 'high';
          planned_month: string | null;
          is_purchased: boolean;
          purchased_price: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['shopping_list']['Row'],
          'id' | 'created_at'
        > & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['shopping_list']['Insert']>;
        Relationships: [];
      };
      budgets: {
        Row: {
          id: string;
          user_id: string;
          category: string;
          month: string;
          amount: number;
        };
        Insert: Omit<Database['public']['Tables']['budgets']['Row'], 'id'> & { id?: string };
        Update: Partial<Database['public']['Tables']['budgets']['Insert']>;
        Relationships: [];
      };
      recurring_income: {
        Row: {
          id: string;
          user_id: string;
          description: string;
          amount: number;
          day_of_month: number | null;
          is_active: boolean;
        };
        Insert: Omit<
          Database['public']['Tables']['recurring_income']['Row'],
          'id'
        > & { id?: string };
        Update: Partial<Database['public']['Tables']['recurring_income']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type TransactionRow = Database['public']['Tables']['transactions']['Row'];
export type CardRow = Database['public']['Tables']['cards']['Row'];
export type ShoppingItemRow = Database['public']['Tables']['shopping_list']['Row'];
export type BudgetRow = Database['public']['Tables']['budgets']['Row'];
export type RecurringIncomeRow = Database['public']['Tables']['recurring_income']['Row'];
