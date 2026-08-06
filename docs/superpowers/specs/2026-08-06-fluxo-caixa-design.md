# Fluxo de Caixa — Módulo de Gestão de Caixas/Metas

**Data:** 2026-08-06
**Status:** Aprovado para implementação

## Contexto

O Financeme já modela a "saúde de gastos do mês" (transações de despesa, cartões, parcelamentos). Falta um domínio separado para **gestão dos ganhos**: o usuário quer distribuir seu saldo previsto mensal (já calculado no Dashboard como entradas − saídas) entre múltiplos "caixas" — categorias/metas como "Fundo Emergência", "Viagem 2026", "Investimentos" — acompanhando quanto foi previsto guardar vs. quanto de fato entrou, e registrando retiradas simplificadas quando o dinheiro é usado.

Essa gestão é deliberadamente desacoplada do controle de despesas: um caixa não tem despesas associadas, apenas entradas (alocação) e retiradas (uso).

## Descoberta relevante

Não existe hoje nenhuma entidade "caixa" no schema. O campo `category` (texto livre) em `transactions` e o `card_id` (FK para `cards`, cartões de crédito) não cobrem esse conceito. É necessário modelar do zero.

## Modelo de dados

### Nova tabela `cashboxes`

```sql
create table cashboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  monthly_goal numeric, -- opcional
  total_goal numeric,   -- opcional
  created_at timestamptz not null default now()
);
```

RLS: mesmo padrão das demais tabelas (`user_id = auth.uid()`).

### Alteração em `transactions`

```sql
alter table transactions add column cashbox_id uuid references cashboxes(id) on delete set null;
```

- Aplicável **somente** a transações `type = 'income'`. O formulário de entrada existente ganha um seletor opcional "Caixa".
- Despesas (`type = 'expense'`) **não** recebem `cashbox_id` — fora de escopo deste módulo.
- Ao excluir um caixa, `cashbox_id` das transações vinculadas vira `null` (`on delete set null`). A transação permanece intacta no lançamento geral e continua contando nos totais do Dashboard normalmente.

### Nova tabela `cashbox_withdrawals`

```sql
create table cashbox_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  cashbox_id uuid references cashboxes(id) on delete cascade not null,
  amount numeric not null,
  withdrawal_date date not null,
  note text,
  created_at timestamptz not null default now()
);
```

RLS: mesmo padrão. Retirada é um registro leve — sem forma de pagamento, sem parcelamento.

**Importante:** retiradas **não** geram lançamento em `transactions` e **não** entram no cálculo de "gastos do mês" do Dashboard. O dinheiro já foi contabilizado como entrada no momento em que foi guardado no caixa (possivelmente em outro mês); contar de novo na retirada duplicaria o valor. Retiradas afetam somente o saldo do caixa.

## Regras de cálculo

Por caixa, por mês corrente:

- **Previsto (mês)**: se `monthly_goal` estiver definida, previsto = `monthly_goal`. Caso contrário, previsto = 0 (o caixa não participa do rateio do saldo previsto do mês).
- **Real (mês)**: soma de `transactions` com `type='income'` e `cashbox_id = X` cuja `transaction_date` cai no mês corrente, menos soma de `cashbox_withdrawals` do mês.
- **Saldo acumulado (total)**: soma histórica de todas as entradas vinculadas ao caixa, menos soma histórica de todas as retiradas. Pode ficar **negativo** (retirada maior que saldo é permitida, sem bloqueio).
- **Progresso vs. meta total**: saldo acumulado / `total_goal` (se definida).
- Cada caixa recebe **exatamente sua `monthly_goal`** do saldo previsto do mês — sem rateio proporcional. O que sobra do saldo previsto (não coberto por nenhuma meta) fica exibido como "não alocado" no header da página.

## UI / Rotas

Nova rota `app/(app)/cashflow/page.tsx`, seguindo o padrão visual de `cards/`, `forecast/`, `installments/`. Adicionada ao menu de navegação do layout `(app)`.

**Estrutura da página:**

- **Header**: saldo previsto do mês (Dashboard), total já alocado em metas mensais, saldo não alocado.
- **Grid de caixas** (um card por caixa): nome, saldo acumulado, progresso do mês (real vs. previsto), barra de progresso vs. meta total (se definida).
- **Botão "Novo caixa"**: formulário/modal com nome (obrigatório), meta mensal (opcional), meta total (opcional).
- **Detalhe do caixa** (ao clicar): histórico de entradas vinculadas + retiradas, ordenado por data.
  - Botão **"Registrar retirada"**: formulário simplificado (valor, data, nota opcional).
  - Ações de editar/excluir o caixa.

**Formulário de entrada (income) existente**: adicionar seletor opcional "Caixa" (dropdown populado com os `cashboxes` do usuário), gravando `cashbox_id` na transação.

## Casos de borda

- Retirada com valor maior que o saldo disponível: **permitida**, saldo do caixa fica negativo.
- Exclusão de caixa com histórico: **permitida**. Transações vinculadas mantidas com `cashbox_id = null` (via `on delete set null`) — o lançamento em si não tem valor fora do caixa, então `cashbox_withdrawals.cashbox_id` usa `on delete cascade`, removendo as retiradas junto com o caixa.
- Caixa sem `monthly_goal` nem `total_goal`: aparece no grid só com saldo acumulado, sem barras de progresso.

## Testes

Cobertura via Vitest (já configurado no projeto):

- Cálculo de previsto/real por caixa (com e sem `monthly_goal`).
- Cálculo de saldo acumulado (entradas − retiradas), incluindo caso negativo.
- Exclusão de caixa: transações mantidas no lançamento geral com `cashbox_id` nulo, seguem contando no Dashboard.
- Retirada não gera lançamento em `transactions` nem afeta "gastos do mês" do Dashboard.
- Rateio do saldo previsto do mês: cada caixa recebe exatamente sua `monthly_goal`; sobra calculada corretamente quando soma das metas < saldo previsto.

## Fora de escopo

- Despesas vinculadas a caixas (deliberadamente fora — "saúde de gastos do mês" é um domínio separado).
- Rateio proporcional entre caixas.
- Alocação automática de investimentos externos (fora do fluxo de retirada/entrada manual).
