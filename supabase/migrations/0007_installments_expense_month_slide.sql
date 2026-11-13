-- Parcelas: expense_month passa a deslizar mês a mês (um mês por parcela), em vez de
-- ficar travado no mês da compra em todas as linhas do grupo.
--
-- Por que: o seletor de ano é um filtro único sobre `transactions`, mas os totais do
-- dashboard (Entrou/Saiu/Saldo/Acumulado/gráficos), o Fluxo de caixa e a coluna
-- "Mês gasto" usam expense_month. Com o valor fixo, uma compra parcelada em 2026 que
-- termina em 2027 somava o valor cheio em 2026 e sumia dos totais de 2027.
--
-- Escopo: só grupos no padrão antigo (todas as parcelas com o MESMO expense_month).
-- Grupos já deslizados (ex.: split bounded-by-year de maio/2026, que gravou
-- expense_month = billing_month por linha) ficam intocados. Idempotente: na segunda
-- execução nenhum grupo bate no critério.
--
-- Multi-tenant: filtra pelo e-mail do dono. Para aplicar a todos os usuários,
-- remova a cláusula `and t.user_id = (...)` nas duas ocorrências.
--
-- Rodar no SQL Editor do Supabase (executa como postgres, ignora RLS).
-- O código novo (lib/domain/installments.ts) já gera parcelas deslizadas.

begin;

-- Pré-visualização: quantas linhas/grupos serão tocados.
with legacy_groups as (
  select t.installment_group_id
  from transactions t
  where t.is_installment
    and t.installment_group_id is not null
    and t.expense_month is not null
    and t.installment_number is not null
    and t.user_id = (select id from auth.users where email = 'socialinformes@gmail.com')
  group by t.installment_group_id
  having count(*) > 1 and count(distinct t.expense_month) = 1
)
select count(*) as linhas, count(distinct installment_group_id) as grupos
from transactions
where installment_group_id in (select installment_group_id from legacy_groups);

-- Aplicação.
with legacy_groups as (
  select t.installment_group_id
  from transactions t
  where t.is_installment
    and t.installment_group_id is not null
    and t.expense_month is not null
    and t.installment_number is not null
    and t.user_id = (select id from auth.users where email = 'socialinformes@gmail.com')
  group by t.installment_group_id
  having count(*) > 1 and count(distinct t.expense_month) = 1
)
update transactions t
set expense_month = (
  date_trunc('month', t.expense_month)::date
  + make_interval(months => t.installment_number - 1)
)::date
where t.installment_group_id in (select installment_group_id from legacy_groups);

-- Conferência: nenhum grupo de parcelas deve ter expense_month repetido.
select installment_group_id, count(*) as parcelas, count(distinct expense_month) as meses_distintos
from transactions
where is_installment and installment_group_id is not null
  and user_id = (select id from auth.users where email = 'socialinformes@gmail.com')
group by installment_group_id
having count(*) > 1 and count(distinct expense_month) < count(*);

commit;

notify pgrst, 'reload schema';
