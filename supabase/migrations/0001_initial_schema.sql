-- Financeiro — schema inicial (2026-04-26)
-- Execute via Supabase SQL editor ou `supabase db push`.

create extension if not exists "pgcrypto";

-- ============================================================================
-- cards
-- ============================================================================
create table if not exists cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  limit_amount numeric(10, 2),
  closing_day integer check (closing_day between 1 and 31),
  due_day integer check (due_day between 1 and 31),
  color text default '#8B5CF6',
  created_at timestamptz not null default now()
);
create index if not exists cards_user_idx on cards (user_id);

-- ============================================================================
-- transactions
-- ============================================================================
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null,
  type text not null check (type in ('income', 'expense')),
  payment_method text not null check (payment_method in ('credit', 'debit', 'pix', 'cash')),
  category text not null,
  notes text,
  expense_month date,
  billing_month date,
  card_id uuid references cards (id) on delete set null,
  is_recurring boolean not null default false,
  is_paid boolean not null default false,
  transaction_date date not null,
  is_installment boolean not null default false,
  installment_number integer,
  total_installments integer,
  installment_group_id uuid,
  installment_end_date date,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_idx on transactions (user_id);
create index if not exists transactions_expense_month_idx on transactions (user_id, expense_month);
create index if not exists transactions_billing_month_idx on transactions (user_id, billing_month);
create index if not exists transactions_card_idx on transactions (card_id);
create index if not exists transactions_group_idx on transactions (installment_group_id);

-- ============================================================================
-- shopping_list
-- ============================================================================
create table if not exists shopping_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity integer not null default 1 check (quantity > 0),
  price_min numeric(10, 2),
  price_max numeric(10, 2),
  reference_url text,
  store_name text,
  category text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  planned_month date,
  is_purchased boolean not null default false,
  purchased_price numeric(10, 2),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists shopping_user_idx on shopping_list (user_id);

-- ============================================================================
-- budgets
-- ============================================================================
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  month date not null,
  amount numeric(10, 2) not null,
  unique (user_id, category, month)
);
create index if not exists budgets_user_idx on budgets (user_id);

-- ============================================================================
-- recurring_income
-- ============================================================================
create table if not exists recurring_income (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  amount numeric(10, 2) not null,
  day_of_month integer check (day_of_month between 1 and 31),
  is_active boolean not null default true
);
create index if not exists recurring_income_user_idx on recurring_income (user_id);

-- ============================================================================
-- RLS
-- ============================================================================
alter table cards enable row level security;
alter table transactions enable row level security;
alter table shopping_list enable row level security;
alter table budgets enable row level security;
alter table recurring_income enable row level security;

drop policy if exists "cards_owner" on cards;
create policy "cards_owner" on cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transactions_owner" on transactions;
create policy "transactions_owner" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "shopping_owner" on shopping_list;
create policy "shopping_owner" on shopping_list
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "budgets_owner" on budgets;
create policy "budgets_owner" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "recurring_income_owner" on recurring_income;
create policy "recurring_income_owner" on recurring_income
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Forçar PostgREST a recarregar o schema (importante após ALTER TABLE)
notify pgrst, 'reload schema';
