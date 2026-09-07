# Exportar Lançamentos em XLSX

**Data:** 2026-09-07
**Objetivo:** Permitir baixar os lançamentos exibidos na tela de Lançamentos como arquivo Excel (.xlsx), respeitando os filtros ativos, para uso fora do app (planilhas, contabilidade, backup pessoal).

---

## 1. Escopo

- Aplica-se apenas à tela `app/(app)/transactions/_view.tsx` (Lançamentos).
- Outras telas (Fluxo de Caixa, Fatura de Cartão) ficam fora deste escopo — podem reaproveitar a função de export depois, se fizer sentido.

## 2. Comportamento

### Botão "Exportar"

- Novo botão no header da tela, ao lado de "Em massa" e "Novo" (mesma linha, `variant="outline"`, ícone `Download` do `lucide-react`).
- Desabilitado (com tooltip "Nada para exportar") quando `sorted.length === 0`.
- Ao clicar, mostra estado de loading no próprio botão (spinner ou texto "Gerando…") enquanto monta o arquivo.

### Dados exportados

- Usa o mesmo array `sorted` que a tabela renderiza — já reflete todos os filtros ativos (tipo, método, status, categoria, mês despesa, mês fatura, busca) e a ordenação da coluna clicada.
- Não faz nova consulta ao Supabase — os dados já estão carregados no client.

### Colunas do arquivo

Nesta ordem:

1. Data (`transaction_date`, formato `dd/mm/aaaa`)
2. Descrição
3. Categoria
4. Tipo (`Receita` / `Despesa`, traduzido de `income`/`expense`)
5. Método (`Crédito` / `Débito` / `Pix` / `Dinheiro`, traduzido de `payment_method`)
6. Valor (numérico, formato moeda R$; negativo para despesa, positivo para receita)
7. Status (`Pago` / `Pendente`, de `is_paid`)
8. Mês despesa (`expense_month`, formato `mm/aaaa`)
9. Mês fatura (`billing_month`, formato `mm/aaaa`, vazio se não houver)
10. Cartão (nome resolvido via `card_id` → `cards`, vazio se não houver)
11. Parcela (`"{installment_number}/{total_installments}"` quando `is_installment`, vazio caso contrário)

### Formatação do arquivo

- Aba única nomeada "Lançamentos".
- Linha de cabeçalho em negrito, com fundo levemente destacado.
- Largura de coluna ajustada ao conteúdo (auto-fit aproximado por maior string da coluna).
- Coluna Valor com number format de moeda (`R$ #,##0.00`); cor de fonte verde para receita, vermelha para despesa.
- Linhas de dados sem zebra/cor adicional (mantém simples).

### Nome e download do arquivo

- Nome: `lancamentos-{ano}.xlsx` (ano = o ano selecionado na tela via `resolveYearWithCookie`).
- Geração via `Blob` + link temporário `<a download>` disparado por clique programático — padrão de download client-side, sem round-trip ao servidor.

## 3. Arquitetura

### Novo arquivo: `lib/export-transactions.ts`

Função pura, sem dependência de React, testável com `vitest`:

```ts
export async function buildTransactionsWorkbook(
  transactions: TransactionRow[],
  cards: CardRow[],
  year: number,
): Promise<ArrayBuffer>
```

- Importa `exceljs` internamente (import estático dentro do módulo — o dynamic import fica na camada do componente, ver abaixo).
- Resolve nome do cartão via `cards` (map por `id`).
- Monta o workbook conforme seção 2 e retorna o buffer pronto pra virar `Blob`.

### Componente `_view.tsx`

- Botão "Exportar" chama um handler `handleExport`:
  1. `import('exceljs')` dinâmico — só baixa a lib quando o usuário exporta pela primeira vez, não pesa o carregamento inicial da tela.
  2. Chama `buildTransactionsWorkbook(sorted, cards, year)`.
  3. Cria `Blob` com o buffer retornado e dispara o download.
  4. Em erro, `toast.error` (mesmo padrão já usado na tela).

### Dependência nova

- `exceljs` (adicionar em `dependencies` do `package.json`).

## 4. Casos de borda

- **Lista vazia**: botão desabilitado, sem gerar arquivo.
- **Erro ao gerar o workbook** (ex: falha ao importar a lib): `toast.error('Erro ao exportar')`, sem quebrar a tela.
- **Muitos lançamentos** (até ~2000, limite já existente da query da página): sem paginação especial — o volume é pequeno o suficiente para gerar em memória sem problema perceptível de performance.
- **Cartão excluído/não encontrado**: coluna Cartão fica vazia em vez de quebrar.

## 5. Testing

1. **Geração do workbook** (`vitest`, testando `buildTransactionsWorkbook` isoladamente)
   - [ ] Gera aba "Lançamentos" com cabeçalho correto
   - [ ] Traduz tipo e método corretamente
   - [ ] Formata valores de receita como positivo e despesa como negativo
   - [ ] Resolve nome do cartão a partir do `card_id`
   - [ ] Monta coluna Parcela apenas quando `is_installment` é true
   - [ ] Lista vazia gera workbook com só o cabeçalho, sem erro

2. **Integração na tela**
   - [ ] Botão desabilitado quando não há linhas filtradas
   - [ ] Exportar com filtro ativo baixa só as linhas filtradas
   - [ ] Nome do arquivo reflete o ano selecionado
   - [ ] Arquivo abre corretamente no Excel/Google Sheets/Numbers

## 6. Escopo fora

- Export em outras telas (Fluxo de Caixa, Fatura de Cartão, Dashboard).
- Escolha de colunas customizável pelo usuário.
- Exportação agendada/automática ou por e-mail.
- Formato CSV como alternativa (fica só XLSX por ora).
