-- Comparativo previsto-vs-real: saldo real que sobrou no mês,
-- contra o calculado a partir das transações.

create table if not exists monthly_actuals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,                          -- primeiro dia do mês (YYYY-MM-01)
  balance numeric(12, 2) not null,              -- saldo real que sobrou (pode ser negativo)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create index if not exists monthly_actuals_user_month_idx
  on monthly_actuals (user_id, month);

alter table monthly_actuals enable row level security;

drop policy if exists "monthly_actuals_owner" on monthly_actuals;
create policy "monthly_actuals_owner" on monthly_actuals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
