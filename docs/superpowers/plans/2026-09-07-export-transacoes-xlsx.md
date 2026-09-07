# Exportar Lançamentos em XLSX — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um botão "Exportar" na tela de Lançamentos (`app/(app)/transactions/_view.tsx`) que baixa os lançamentos atualmente filtrados como um arquivo `.xlsx` formatado.

**Architecture:** Uma função pura `buildTransactionsWorkbook` em `lib/export-transactions.ts` monta o workbook com `exceljs` a partir do array já filtrado/ordenado que a tabela exibe. O componente carrega esse módulo via `import()` dinâmico (code-split, só baixa a lib quando o usuário clica em Exportar) e dispara o download via `Blob` + link temporário — sem nova rota de API, sem nova consulta ao Supabase.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `exceljs` (nova dependência), `vitest` para testes.

## Global Constraints

- Spec de referência: `docs/superpowers/specs/2026-09-07-export-transacoes-xlsx-design.md`
- Escopo apenas a tela de Lançamentos — nenhuma outra tela é tocada.
- Sem nova rota de API — geração 100% client-side.
- Testes de `lib/` seguem o padrão do projeto: arquivo `*.test.ts` ao lado do módulo, rodado via `npm test` (vitest, `include: ['lib/**/*.test.ts']`).
- Nome do arquivo baixado: `lancamentos-{ano}.xlsx`.

---

### Task 1: Adicionar dependência `exceljs`

**Files:**
- Modify: `package.json` (via `npm install`, não editar manualmente)
- Modify: `package-lock.json` (gerado automaticamente pelo `npm install`)

**Interfaces:**
- Produces: pacote `exceljs` disponível para import em `lib/export-transactions.ts` (Task 2).

- [ ] **Step 1: Instalar o pacote**

Run: `cd /Users/felipep./projetos/financeiro && npm install exceljs`

Expected: `package.json` ganha `"exceljs": "^4.x.x"` em `dependencies`, `package-lock.json` é atualizado, comando termina sem erro.

- [ ] **Step 2: Confirmar a instalação**

Run: `cd /Users/felipep./projetos/financeiro && node -e "console.log(require('exceljs/package.json').version)"`

Expected: imprime uma versão (ex: `4.4.0`), sem erro de módulo não encontrado.

- [ ] **Step 3: Commit**

```bash
cd /Users/felipep./projetos/financeiro
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: adiciona exceljs para exportação de lançamentos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013pZqi5FGKNo7r6hQSceHvR
EOF
)"
```

---

### Task 2: Criar `buildTransactionsWorkbook` (TDD)

**Files:**
- Create: `lib/export-transactions.ts`
- Test: `lib/export-transactions.test.ts`

**Interfaces:**
- Consumes: `TransactionRow`, `CardRow` de `@/lib/supabase/types` (campos já existentes: `TransactionRow.{id,description,amount,type,payment_method,category,expense_month,billing_month,card_id,is_paid,transaction_date,is_installment,installment_number,total_installments}`; `CardRow.{id,name}`); `formatDateBR`, `formatMonthBR` de `@/lib/format`.
- Produces: `export async function buildTransactionsWorkbook(transactions: TransactionRow[], cards: CardRow[]): Promise<ArrayBuffer>` — usado pelo componente na Task 3.

- [ ] **Step 1: Escrever os testes**

Create `lib/export-transactions.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildTransactionsWorkbook } from './export-transactions';
import type { TransactionRow, CardRow } from './supabase/types';

function transaction(over: Partial<TransactionRow>): TransactionRow {
  return {
    id: 't1',
    user_id: 'u1',
    description: 'Mercado',
    amount: 150,
    type: 'expense',
    payment_method: 'debit',
    category: 'Alimentação',
    notes: null,
    expense_month: '2026-09-01',
    billing_month: null,
    card_id: null,
    cashbox_id: null,
    is_recurring: false,
    is_paid: true,
    transaction_date: '2026-09-05',
    is_installment: false,
    installment_number: null,
    total_installments: null,
    installment_group_id: null,
    installment_end_date: null,
    created_at: '2026-09-05T00:00:00Z',
    ...over,
  };
}

function card(over: Partial<CardRow>): CardRow {
  return {
    id: 'c1',
    user_id: 'u1',
    name: 'Nubank',
    brand: null,
    limit_amount: null,
    closing_day: null,
    due_day: null,
    color: null,
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

async function readSheet(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet('Lançamentos');
  if (!sheet) throw new Error('aba Lançamentos não encontrada');
  return sheet;
}

describe('buildTransactionsWorkbook', () => {
  it('gera aba "Lançamentos" com cabeçalho correto', async () => {
    const buffer = await buildTransactionsWorkbook([], []);
    const sheet = await readSheet(buffer);
    const headerValues = (sheet.getRow(1).values as unknown[]).slice(1);
    expect(headerValues).toEqual([
      'Data',
      'Descrição',
      'Categoria',
      'Tipo',
      'Método',
      'Valor',
      'Status',
      'Mês despesa',
      'Mês fatura',
      'Cartão',
      'Parcela',
    ]);
  });

  it('traduz tipo e método', async () => {
    const tx = transaction({ type: 'income', payment_method: 'pix' });
    const buffer = await buildTransactionsWorkbook([tx], []);
    const sheet = await readSheet(buffer);
    const row = sheet.getRow(2);
    expect(row.getCell('type').value).toBe('Receita');
    expect(row.getCell('method').value).toBe('Pix');
  });

  it('formata valor de receita como positivo e despesa como negativo', async () => {
    const income = transaction({ id: 't1', type: 'income', amount: 500 });
    const expense = transaction({ id: 't2', type: 'expense', amount: 200 });
    const buffer = await buildTransactionsWorkbook([income, expense], []);
    const sheet = await readSheet(buffer);
    expect(sheet.getRow(2).getCell('amount').value).toBe(500);
    expect(sheet.getRow(3).getCell('amount').value).toBe(-200);
  });

  it('resolve o nome do cartão a partir do card_id', async () => {
    const tx = transaction({ card_id: 'c1' });
    const buffer = await buildTransactionsWorkbook([tx], [card({ id: 'c1', name: 'Nubank' })]);
    const sheet = await readSheet(buffer);
    expect(sheet.getRow(2).getCell('card').value).toBe('Nubank');
  });

  it('deixa a coluna Cartão vazia quando o cartão não é encontrado', async () => {
    const tx = transaction({ card_id: 'inexistente' });
    const buffer = await buildTransactionsWorkbook([tx], []);
    const sheet = await readSheet(buffer);
    expect(sheet.getRow(2).getCell('card').value).toBe('');
  });

  it('monta a coluna Parcela apenas quando is_installment é true', async () => {
    const installment = transaction({
      id: 't1',
      is_installment: true,
      installment_number: 3,
      total_installments: 12,
    });
    const single = transaction({ id: 't2', is_installment: false });
    const buffer = await buildTransactionsWorkbook([installment, single], []);
    const sheet = await readSheet(buffer);
    expect(sheet.getRow(2).getCell('installment').value).toBe('3/12');
    expect(sheet.getRow(3).getCell('installment').value).toBe('');
  });

  it('lista vazia gera workbook só com o cabeçalho, sem erro', async () => {
    const buffer = await buildTransactionsWorkbook([], []);
    const sheet = await readSheet(buffer);
    expect(sheet.rowCount).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd /Users/felipep./projetos/financeiro && npx vitest run lib/export-transactions.test.ts`

Expected: FAIL — `Cannot find module './export-transactions'` (o arquivo `lib/export-transactions.ts` ainda não existe).

- [ ] **Step 3: Implementar `lib/export-transactions.ts`**

Create `lib/export-transactions.ts`:

```ts
import ExcelJS from 'exceljs';
import { formatDateBR, formatMonthBR } from './format';
import type { TransactionRow, CardRow } from './supabase/types';

const TYPE_LABEL: Record<TransactionRow['type'], string> = {
  income: 'Receita',
  expense: 'Despesa',
};

const METHOD_LABEL: Record<TransactionRow['payment_method'], string> = {
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'Pix',
  cash: 'Dinheiro',
};

const INCOME_COLOR = 'FF16A34A';
const EXPENSE_COLOR = 'FFDC2626';
const HEADER_FILL = 'FFE5E7EB';

export async function buildTransactionsWorkbook(
  transactions: TransactionRow[],
  cards: CardRow[],
): Promise<ArrayBuffer> {
  const cardNameById = new Map(cards.map((c) => [c.id, c.name]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Lançamentos');

  sheet.columns = [
    { header: 'Data', key: 'date', width: 12 },
    { header: 'Descrição', key: 'description', width: 32 },
    { header: 'Categoria', key: 'category', width: 18 },
    { header: 'Tipo', key: 'type', width: 10 },
    { header: 'Método', key: 'method', width: 10 },
    { header: 'Valor', key: 'amount', width: 14 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Mês despesa', key: 'expenseMonth', width: 12 },
    { header: 'Mês fatura', key: 'billingMonth', width: 12 },
    { header: 'Cartão', key: 'card', width: 16 },
    { header: 'Parcela', key: 'installment', width: 10 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });

  for (const t of transactions) {
    const signedAmount =
      t.type === 'income' ? Math.abs(Number(t.amount)) : -Math.abs(Number(t.amount));

    const row = sheet.addRow({
      date: formatDateBR(t.transaction_date),
      description: t.description,
      category: t.category,
      type: TYPE_LABEL[t.type],
      method: METHOD_LABEL[t.payment_method],
      amount: signedAmount,
      status: t.is_paid ? 'Pago' : 'Pendente',
      expenseMonth: formatMonthBR(t.expense_month),
      billingMonth: formatMonthBR(t.billing_month),
      card: t.card_id ? (cardNameById.get(t.card_id) ?? '') : '',
      installment:
        t.is_installment && t.installment_number && t.total_installments
          ? `${t.installment_number}/${t.total_installments}`
          : '',
    });

    const amountCell = row.getCell('amount');
    amountCell.numFmt = '"R$" #,##0.00';
    amountCell.font = { color: { argb: t.type === 'income' ? INCOME_COLOR : EXPENSE_COLOR } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd /Users/felipep./projetos/financeiro && npx vitest run lib/export-transactions.test.ts`

Expected: PASS — 7 testes passando.

- [ ] **Step 5: Rodar a suíte completa para checar regressões**

Run: `cd /Users/felipep./projetos/financeiro && npm test`

Expected: PASS — todos os testes existentes continuam passando, mais os 7 novos.

- [ ] **Step 6: Commit**

```bash
cd /Users/felipep./projetos/financeiro
git add lib/export-transactions.ts lib/export-transactions.test.ts
git commit -m "$(cat <<'EOF'
feat: adiciona buildTransactionsWorkbook para exportar lançamentos em XLSX

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013pZqi5FGKNo7r6hQSceHvR
EOF
)"
```

---

### Task 3: Botão "Exportar" na tela de Lançamentos

**Files:**
- Modify: `app/(app)/transactions/_view.tsx:5-16` (import de ícones)
- Modify: `app/(app)/transactions/_view.tsx:220-236` (novo state `exporting`)
- Modify: `app/(app)/transactions/_view.tsx:333-343` (novo handler `handleExport`, logo após a função `remove`)
- Modify: `app/(app)/transactions/_view.tsx:359-360` (novo botão no header, antes do `Sheet` "Em massa")

**Interfaces:**
- Consumes: `buildTransactionsWorkbook(transactions: TransactionRow[], cards: CardRow[]): Promise<ArrayBuffer>` de `@/lib/export-transactions` (Task 2); array `sorted` e variáveis `cards`, `year` já existentes no componente.

- [ ] **Step 1: Adicionar o ícone `Download` ao import de `lucide-react`**

Em `app/(app)/transactions/_view.tsx`, localizar (linhas 5-16):

```ts
import {
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  Pencil,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react';
```

Substituir por:

```ts
import {
  Plus,
  Search,
  Trash2,
  CheckCircle2,
  Pencil,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  Download,
} from 'lucide-react';
```

- [ ] **Step 2: Adicionar o state `exporting`**

Localizar, logo após `const [loadingGroup, setLoadingGroup] = useState(false);` (linha ~226, antes de `const [filters, setFilters] = useState<Filters>({`):

```ts
  const [loadingGroup, setLoadingGroup] = useState(false);
```

Inserir logo abaixo:

```ts
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [exporting, setExporting] = useState(false);
```

- [ ] **Step 3: Adicionar o handler `handleExport`**

Localizar a função `remove` (linhas 333-342):

```ts
  const remove = async (t: TransactionRow) => {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('transactions').delete().eq('id', t.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Excluído');
      refresh();
    }
  };
```

Inserir logo abaixo (antes do `return (`):

```ts

  const handleExport = async () => {
    setExporting(true);
    try {
      const { buildTransactionsWorkbook } = await import('@/lib/export-transactions');
      const buffer = await buildTransactionsWorkbook(sorted, cards);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lancamentos-${year}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${sorted.length} lançamentos exportados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };
```

- [ ] **Step 4: Adicionar o botão no header**

Localizar (linhas 359-360):

```tsx
        <div className="flex gap-2">
          <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
```

Substituir por:

```tsx
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || sorted.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            {exporting ? 'Gerando…' : 'Exportar'}
          </Button>
          <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
```

- [ ] **Step 5: Checar tipos e lint**

Run: `cd /Users/felipep./projetos/financeiro && npx tsc --noEmit && npm run lint`

Expected: sem erros novos. Se `sorted` for declarado com `const` após o ponto onde `handleExport` é definido no arquivo, isso não é problema — `sorted` já é declarado nas linhas ~282-295, antes da função `remove` (linha 333) onde `handleExport` foi inserido.

- [ ] **Step 6: Testar manualmente no navegador**

Run: `cd /Users/felipep./projetos/financeiro && npm run dev`

- Abrir `http://localhost:3000`, logar, ir em Lançamentos.
- Confirmar que o botão "Exportar" aparece no header, à esquerda de "Em massa".
- Aplicar um filtro (ex: categoria específica) e clicar em "Exportar" — confirmar que o arquivo baixado (`lancamentos-{ano}.xlsx`) abre no Excel/Google Sheets/Numbers e contém **apenas** as linhas filtradas.
- Limpar os filtros e exportar de novo — confirmar que reflete todas as linhas da tela.
- Conferir visualmente: cabeçalho em negrito, valores em R$, receitas em verde, despesas em vermelho.
- Filtrar para um resultado vazio — confirmar que o botão fica desabilitado.

Expected: arquivo baixa corretamente, abre sem erro em pelo menos um leitor de planilha, dados batem com o que está na tela.

- [ ] **Step 7: Commit**

```bash
cd /Users/felipep./projetos/financeiro
git add "app/(app)/transactions/_view.tsx"
git commit -m "$(cat <<'EOF'
feat: adiciona botão de exportar lançamentos em XLSX na tela de Lançamentos

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013pZqi5FGKNo7r6hQSceHvR
EOF
)"
```
