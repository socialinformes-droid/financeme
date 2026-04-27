-- Categorias editáveis por user.
-- transactions.category continua text livre (sem FK) pra tolerar renomes
-- e não exigir migração de 414 linhas. A tabela serve pra:
--   1. UI pegar a lista pro select
--   2. cor por categoria (lookup name → color)
--   3. CRUD pelo /settings

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists categories_user_idx on categories (user_id);

alter table categories enable row level security;

drop policy if exists "categories_owner" on categories;
create policy "categories_owner" on categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
