-- supabase/migrations/0005_cashbox_deposits.sql
-- Depósito em caixa: espelho de cashbox_withdrawals, soma em vez de subtrair.
-- Substitui o modelo antigo de vincular cashbox_id a uma transação de
-- lançamento geral — depósitos não tocam `transactions` nem o Dashboard,
-- evitando duplicar ganho já contabilizado em outro lançamento (ver
-- docs/superpowers/specs/2026-08-07-fluxo-caixa-correcao-dashboard-design.md).
-- Execute via Supabase SQL editor ou `supabase db push`.

create table if not exists cashbox_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  cashbox_id uuid not null references cashboxes (id) on delete cascade,
  amount numeric not null,
  deposit_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists cashbox_deposits_cashbox_idx on cashbox_deposits (cashbox_id);
create index if not exists cashbox_deposits_user_idx on cashbox_deposits (user_id);

alter table cashbox_deposits enable row level security;

drop policy if exists "cashbox_deposits_owner" on cashbox_deposits;
create policy "cashbox_deposits_owner" on cashbox_deposits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
