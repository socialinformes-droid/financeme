# Extrato comparativo de cartões — Design

**Data:** 2026-06-22
**Status:** Aprovado para implementação

## Problema

Hoje a tela de Cartões (`app/(app)/cards/_view.tsx`) mostra, por cartão, só
totais: a fatura do mês atual, % do limite e um histórico de 6 meses. Não dá pra
abrir e ver **o que compõe** a fatura, nem distinguir o gasto fixo (recorrente)
da compra avulsa ou parcelada. Resultado: é impossível entender o "piso fixo
mensal" que cada cartão carrega, ou comparar esse piso entre cartões.

## Objetivo

Adicionar uma seção **"Extrato comparativo"** na tela de Cartões onde o usuário
seleciona até 3 cartões e vê o extrato de cada um em colunas lado a lado,
referentes a um mês único, com os lançamentos agrupados em fixos / parcelados /
avulsos — deixando o piso fixo de cada cartão óbvio e comparável.

## Modelo de dados (já existente, sem alterações)

Campos relevantes em `transactions`:
- `card_id` — vínculo com o cartão.
- `billing_month` (date, dia 1) — em qual fatura a transação cai.
- `is_recurring` — gasto fixo/recorrente.
- `is_installment` + `installment_number` + `total_installments` — parcelado.
- `category` — a linha "fatura base" não-itemizada usa `category = 'Cartão'`.
- `amount`, `type` (`expense`/`income`), `description`.

Conceito herdado do `FaturaGrid`: a fatura de um cartão num mês é a soma de
**transações itemizadas** (compras individuais) + uma eventual **linha "base"**
(`category = 'Cartão'` sem `(` na descrição), que representa o resto não-detalhado
do extrato. Placeholders de fatura têm `amount = 0`.

## Classificação dos lançamentos (exclusiva, 1 grupo por transação)

Para cada transação com `card_id` e `billing_month` iguais ao filtro, e
`type = 'expense'`, classificar na primeira regra que casar:

1. **Fixos** — `is_recurring = true`.
2. **Parcelados** — `is_installment = true` (e não recorrente). Linha exibe
   etiqueta `installment_number/total_installments` (ex.: `3/10`).
3. **Avulsos** — o restante itemizado. A linha "base" (`category = 'Cartão'`,
   `amount != 0`) entra no rodapé deste grupo como "demais lançamentos do
   extrato".

Placeholders (`category = 'Cartão'` com `amount = 0`) são ignorados.

## Arquitetura

### Helper compartilhado — `lib/domain/card-fatura-composition.ts` (novo)

Extrai a lógica de classificação lump-vs-itemizado hoje embutida em
`components/cards/fatura-grid.tsx`, criando uma fonte de verdade única.

Funções:
- `isLumpFatura(t: TransactionRow): boolean` — `category === 'Cartão' && !description.includes('(')`.
- `composeFatura(transactions, cardId, billingMonth): FaturaComposition` —
  filtra por cartão+mês e devolve os grupos com subtotais e total.

```ts
type FaturaLine = { tx: TransactionRow; installmentLabel?: string };
type FaturaComposition = {
  fixed: FaturaLine[];
  installments: FaturaLine[];
  oneOff: FaturaLine[];
  baseAmount: number;   // soma das linhas "base" não-itemizadas (amount != 0)
  fixedTotal: number;
  installmentsTotal: number;
  oneOffTotal: number;  // inclui baseAmount
  total: number;
};
```

`fatura-grid.tsx` passa a importar `isLumpFatura` em vez da expressão inline.
Comportamento do grid permanece idêntico.

### Novo componente — `components/cards/extrato-comparativo.tsx` (Client)

Props: `{ cards: CardRow[]; transactions: TransactionRow[]; year: number }`.

Estado local:
- `selectedIds: string[]` — até 3 cartões. Default: os 3 primeiros cartões (ou
  quantos existirem).
- `billingMonth: string` (ISO dia 1) — default mês corrente.

Render:
- **Controles:** chips de seleção de cartões (desabilita novos quando já há 3
  selecionados; clicar num selecionado remove). Seletor de mês `‹ Junho 2026 ›`
  com `addMonthsToISO` (reusa `lib/format`).
- **Colunas:** uma por cartão selecionado, em grid responsivo (`md:grid-cols-2`,
  `xl:grid-cols-3`); empilha no mobile. Cada coluna:
  - Cabeçalho: nome (borda na cor do cartão), total da fatura do mês, % do limite
    quando `limit_amount > 0`.
  - Três grupos na ordem fixos → parcelados → avulsos, cada um com subtotal.
    Fixos sempre visível (mostra "—" / R$0 se vazio) para reforçar a comparação.
  - Estado vazio por coluna: "Sem lançamentos nesta fatura".

### Integração — `app/(app)/cards/_view.tsx`

Inserir `<ExtratoComparativo cards={initialCards} transactions={transactions} year={year} />`
entre o `FaturaGrid` e o bloco "Por cartão". Reusa as props que a view já recebe;
nenhuma query nova.

## Fluxo de dados

`page.tsx` (inalterado) já carrega `cards` e as `transactions` do ano (filtradas
por `billing_month` no ano, limite 2000). O `ExtratoComparativo` recebe essas
props e faz todo o filtro (cartão + mês) e a composição client-side via o helper.

Limitação aceita nesta versão: navegar para um mês fora do ano carregado mostra
só o que estiver em memória (faturas vazias), sem nova ida ao servidor. A
navegação de ano continua sendo a da tela (query string `?year=`).

## Tratamento de erros / casos de borda

- **Nenhum cartão:** a seção não renderiza (a view já tem early-return para zero
  cartões antes desse bloco).
- **Mês sem lançamentos:** colunas mostram total R$0 e grupos vazios.
- **Cartão sem limite:** omite a barra/percentual de limite.
- **Transação sem `billing_month`:** ignorada (não cai em nenhuma fatura).

## Testes

- Teste unitário de `composeFatura`: dado um conjunto de transações, verifica
  classificação exclusiva (recorrente vs parcelado vs avulso), inclusão da linha
  base em `oneOff`, exclusão de placeholders, e os subtotais/total.
- Teste de `isLumpFatura`: cobre `category='Cartão'` com e sem `(` e categorias
  diversas.
- Verificação manual: `FaturaGrid` continua somando faturas igual ao
  comportamento atual após a extração do helper.

## Fora de escopo

- Alterações de schema.
- Edição de lançamentos a partir do extrato (somente leitura nesta versão).
- Busca incremental ao servidor ao trocar de mês entre anos.
- Mudanças em dashboard, formulários ou no fluxo de pagamento.
