-- supabase/migrations/0004_cashboxes.sql
-- Fluxo de caixa: caixas (metas de acumulação) e retiradas.
-- cashbox_id em transactions só se aplica a type='income' — despesas não se
-- vinculam a caixa (ver docs/superpowers/specs/2026-08-06-fluxo-caixa-design.md).
-- Execute via Supabase SQL editor ou `supabase db push`.

create table if not exists cashboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  monthly_goal numeric,
  total_goal numeric,
  created_at timestamptz not null default now()
);

create index if not exists cashboxes_user_idx on cashboxes (user_id);

alter table cashboxes enable row level security;

drop policy if exists "cashboxes_owner" on cashboxes;
create policy "cashboxes_owner" on cashboxes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists cashbox_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cashbox_id uuid not null references cashboxes (id) on delete cascade,
  amount numeric not null,
  withdrawal_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cashbox_withdrawals_cashbox_idx on cashbox_withdrawals (cashbox_id);
create index if not exists cashbox_withdrawals_user_idx on cashbox_withdrawals (user_id);

alter table cashbox_withdrawals enable row level security;

drop policy if exists "cashbox_withdrawals_owner" on cashbox_withdrawals;
create policy "cashbox_withdrawals_owner" on cashbox_withdrawals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table transactions
  add column if not exists cashbox_id uuid references cashboxes (id) on delete set null;

create index if not exists transactions_cashbox_idx on transactions (cashbox_id);

notify pgrst, 'reload schema';
