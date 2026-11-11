-- Lançamentos previstos: is_active = false fica só listado, fora de saldos e totais.
alter table transactions
  add column if not exists is_active boolean not null default true;

create index if not exists transactions_active_idx
  on transactions (user_id, is_active);

notify pgrst, 'reload schema';
