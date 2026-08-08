# Correção: Entradas de Caixa Não Devem Contar no Dashboard

**Data:** 2026-08-07
**Status:** Aprovado para implementação

## Contexto

O módulo de fluxo de caixa (`docs/superpowers/specs/2026-08-06-fluxo-caixa-design.md`) foi implementado, revisado e mergeado com o seguinte mecanismo: o formulário de lançamento geral ganhou um seletor opcional de "Caixa", disponível para transações `type='income'` não-recorrentes. Selecionar um caixa gravava `cashbox_id` na própria transação, e o "real do mês"/"saldo" do caixa eram calculados somando essas transações.

Na prática, isso causa duplicação: guardar dinheiro num caixa (ex: R$500 pro "Fundo Emergência") exige criar uma **nova transação de entrada**, que soma R$500 ao total de "Entradas" do Dashboard — mesmo quando esse dinheiro já havia sido contabilizado como renda em outro lançamento (salário, freela). O usuário não está recebendo uma nova renda ao alocar pro caixa; está apenas reservando parte de um dinheiro que já tem. O modelo correto, análogo ao das retiradas (que já não tocam o Dashboard), é: **alocar num caixa é um movimento interno, não uma nova entrada de caixa geral.**

## Mudança de modelo

Assim como `cashbox_withdrawals` já existe como registro leve e desacoplado de `transactions`, esta correção introduz **`cashbox_deposits`** como seu par simétrico. Vínculo de caixa deixa de existir em transações de lançamento geral.

## Modelo de dados

### Nova tabela `cashbox_deposits` (migration aditiva)

```sql
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
```

Mesma estrutura de `cashbox_withdrawals`, apenas com `deposit_date` no lugar de `withdrawal_date`.

### `transactions.cashbox_id`

A coluna **permanece** no schema (não é removida — evita risco de migração destrutiva), mas nenhum fluxo novo grava nela. Transações antigas que porventura já tenham `cashbox_id` preenchido (deploy muito recente, risco baixo) tornam-se **órfãs/informativas**: não contam mais no cálculo de saldo do caixa a partir desta correção. Antes de aplicar a migration desta correção, rodar `select count(*) from transactions where cashbox_id is not null;` no Supabase — se houver linhas, decidir manualmente se convertê-las em `cashbox_deposits` equivalentes ou apenas descartar o vínculo (fora do escopo automatizado desta correção).

## Cálculos de domínio

`lib/domain/cashboxes.ts` — `cashboxRealMonth` e `cashboxBalance` trocam a fonte de "entradas" de `transactions` para `cashbox_deposits`:

- **Assinatura anterior:** `cashboxRealMonth(cashboxId, monthKey, transactions, withdrawals)`
- **Assinatura nova:** `cashboxRealMonth(cashboxId, monthKey, deposits, withdrawals)` — soma `deposits` do caixa no mês (por `deposit_date`, prefixo `YYYY-MM`, mesma regra de correspondência já usada pra `withdrawal_date`) menos `withdrawals` do mês.
- **`cashboxBalance`:** idem, histórico completo de `deposits` menos `withdrawals`.
- **`calculateMonthlyForecastBalance`** e **`calculateAllocation`** não mudam — não dependem de vínculo com caixa.

## Interface

- **Nova:** `components/forms/cashbox-deposit-form.tsx` — espelho de `CashboxWithdrawalForm` (valor, data, nota opcional), insere em `cashbox_deposits`.
- **`app/(app)/cashflow/_view.tsx`:**
  - Botão "Registrar entrada" ao lado do "Registrar retirada" no detalhe do caixa.
  - `selectedHistory` mescla `deposits` (positivo, `kind: 'deposit'`) e `withdrawals` (negativo, `kind: 'withdrawal'`), como hoje mescla transações e retiradas.
  - Página busca `cashbox_deposits` no lugar da query de transações vinculadas a caixa.
- **Reversão em `components/forms/transaction-form.tsx`:** remover o seletor "Caixa (opcional)", o campo `cashbox_id` do schema zod, e sua gravação nos payloads de insert/update.
- **Reversão em `app/(app)/transactions/page.tsx` e `_view.tsx`:** remover a query de `cashboxes` e a prop `cashboxes` passada ao `TransactionForm`.

## Testes

`lib/domain/cashboxes.test.ts` é reescrito: os testes de `cashboxRealMonth`/`cashboxBalance` passam a usar uma factory `deposit(...)` no lugar de `tx(...)`, cobrindo os mesmos casos (mês, caixa, saldo negativo). Testes de `calculateMonthlyForecastBalance` e `calculateAllocation` não mudam.

## Fora de escopo

- Migração automática de dados históricos (`transactions.cashbox_id` já preenchido) para `cashbox_deposits` — verificação manual antes do deploy, conversão fica de fora se necessária.
- Remoção física da coluna `transactions.cashbox_id` — mantida por segurança, sem uso futuro.
