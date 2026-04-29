'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CATEGORIES } from '@/lib/domain/categories';
import { formatBRL, formatDateBR, formatMonthBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet';
import { TransactionForm } from '@/components/forms/transaction-form';
import { BulkTransactionsForm } from '@/components/forms/bulk-transactions-form';
import type { TransactionRow, CardRow, CategoryRow } from '@/lib/supabase/types';

type SelectOption = { value: string; label: string };

function MultiSelect({
  label,
  values,
  onChange,
  options,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: SelectOption[];
}) {
  const isNeutral = values.length === 0 || values.length === options.length;
  const display =
    values.length === 0 || values.length === options.length
      ? null
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? '')
        : `${values.length} selecionados`;

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  const selectAll = () => onChange(options.map((o) => o.value));
  const clear = () => onChange([]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50"
          />
        }
      >
        {isNeutral ? (
          <span className="text-muted-foreground/70 text-[11px] uppercase tracking-wider">
            {label}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 truncate">
            <span className="text-muted-foreground/70 text-[11px] uppercase tracking-wider shrink-0">
              {label}
            </span>
            <span className="text-foreground/85 truncate">{display}</span>
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-72 min-w-44">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="uppercase tracking-wider text-[10px]">{label}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              todos
            </button>
            {values.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                limpar
              </button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={values.includes(o.value)}
            onCheckedChange={() => toggle(o.value)}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TxType = 'income' | 'expense';
type PaymentMethod = 'credit' | 'debit' | 'pix' | 'cash';
type StatusFilter = 'paid' | 'pending';

type Filters = {
  q: string;
  type: TxType[];
  method: PaymentMethod[];
  status: StatusFilter[];
  category: string[];
  expenseMonth: string[];
};

type SortKey =
  | 'description'
  | 'category'
  | 'payment_method'
  | 'transaction_date'
  | 'expense_month'
  | 'billing_month'
  | 'amount';
type SortDir = 'asc' | 'desc';
type SortState = { key: SortKey; dir: SortDir };

const NUMERIC_KEYS: SortKey[] = ['amount'];

function SortHead({
  label,
  sortKey,
  sort,
  onToggle,
  align = 'left',
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onToggle: (k: SortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = sort.key === sortKey;
  const isNumeric = NUMERIC_KEYS.includes(sortKey) || sortKey.endsWith('_date') || sortKey.endsWith('_month');
  const ascLabel = isNumeric ? 'menor → maior' : 'A → Z';
  const descLabel = isNumeric ? 'maior → menor' : 'Z → A';
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  const title = active
    ? `Ordenado: ${sort.dir === 'asc' ? ascLabel : descLabel} — clique para inverter`
    : `Ordenar (${ascLabel} / ${descLabel})`;
  return (
    <TableHead className={`${align === 'right' ? 'text-right' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        title={title}
        className={`inline-flex items-center gap-1 select-none hover:text-foreground transition ${
          active ? 'text-foreground' : 'text-muted-foreground'
        } ${align === 'right' ? 'flex-row-reverse' : ''}`}
      >
        <span>{label}</span>
        <Icon className="h-3 w-3 opacity-70" />
      </button>
    </TableHead>
  );
}

export function TransactionsView({
  userId,
  initialTransactions,
  cards,
  categories,
  year,
}: {
  userId: string;
  initialTransactions: TransactionRow[];
  cards: CardRow[];
  categories: CategoryRow[];
  year: number;
}) {
  const categoryNames = categories.length
    ? categories.map((c) => c.name)
    : DEFAULT_CATEGORIES.map((c) => c.name);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    q: '',
    type: [],
    method: [],
    status: [],
    category: [],
    expenseMonth: [],
  });
  const [sort, setSort] = useState<SortState>({ key: 'transaction_date', dir: 'desc' });
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const t of initialTransactions) if (t.expense_month) set.add(t.expense_month);
    return [...set].sort().reverse();
  }, [initialTransactions]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return initialTransactions.filter((t) => {
      if (filters.type.length && !filters.type.includes(t.type as TxType)) return false;
      if (filters.method.length && !filters.method.includes(t.payment_method as PaymentMethod))
        return false;
      if (filters.status.length) {
        const s: StatusFilter = t.is_paid ? 'paid' : 'pending';
        if (!filters.status.includes(s)) return false;
      }
      if (filters.category.length && !filters.category.includes(t.category)) return false;
      if (filters.expenseMonth.length && !filters.expenseMonth.includes(t.expense_month ?? ''))
        return false;
      if (q && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initialTransactions, filters]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of filtered) {
      if (t.type === 'income') income += Number(t.amount);
      else expense += Math.abs(Number(t.amount));
    }
    return { income, expense, balance: income - expense, count: filtered.length };
  }, [filtered]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const { key, dir } = sort;
    const mult = dir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      if (key === 'amount') {
        return (Number(a.amount) - Number(b.amount)) * mult;
      }
      const av = (a[key] ?? '') as string;
      const bv = (b[key] ?? '') as string;
      return av.localeCompare(bv, 'pt-BR', { numeric: true, sensitivity: 'base' }) * mult;
    });
    return arr;
  }, [filtered, sort]);

  const refresh = () => startTransition(() => router.refresh());

  const togglePaid = async (t: TransactionRow) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('transactions')
      .update({ is_paid: !t.is_paid })
      .eq('id', t.id);
    if (error) toast.error(error.message);
    else {
      toast.success(t.is_paid ? 'Marcada como pendente' : 'Marcada como paga');
      refresh();
    }
  };

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

  return (
    <div className="space-y-5">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-4 border-b border-rule/60">
        <div>
          <p className="eyebrow">Caderno de</p>
          <h2 className="headline text-4xl font-light tracking-tight">Lançamentos</h2>
          <p className="text-xs italic text-muted-foreground mt-1.5">
            <span className="font-mono not-italic mr-1">{year}</span> · {totals.count} {totals.count === 1 ? 'linha' : 'linhas'} · entradas{' '}
            <span className="font-mono not-italic">{formatBRL(totals.income)}</span> · saídas{' '}
            <span className="font-mono not-italic">{formatBRL(totals.expense)}</span> · saldo{' '}
            <span className={`font-mono not-italic ${totals.balance >= 0 ? 'text-money-up' : 'text-money-down'}`}>
              {formatBRL(totals.balance)}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
            <SheetTrigger render={<Button variant="outline" />} onClick={() => setBulkOpen(true)}>
              <Layers className="mr-2 h-4 w-4" />
              Em massa
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Lançamento em massa</SheetTitle>
                <SheetDescription>
                  Cria várias transações de uma vez — uma por mês com valores que podem variar. Mês com R$ 0 é pulado.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 px-4 pb-4">
                <BulkTransactionsForm
                  userId={userId}
                  cards={cards}
                  categories={categories}
                  onDone={() => {
                    setBulkOpen(false);
                    refresh();
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>

          <Sheet
            open={open || !!editing}
            onOpenChange={(o) => {
              if (!o) {
                setOpen(false);
                setEditing(null);
              }
            }}
          >
            <SheetTrigger render={<Button />} onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editing ? 'Editar lançamento' : 'Novo lançamento'}</SheetTitle>
                <SheetDescription>
                  {editing
                    ? 'As mudanças são aplicadas só nesta linha.'
                    : 'Crédito calcula o mês da fatura automaticamente. Ative parcelado para gerar N transações.'}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 px-4 pb-4">
                <TransactionForm
                  key={editing?.id ?? 'new'}
                  userId={userId}
                  cards={cards}
                  categories={categories}
                  editing={editing}
                  onDone={() => {
                    setOpen(false);
                    setEditing(null);
                    refresh();
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Filtros */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <div className="col-span-2 md:col-span-2 relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar descrição..."
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <MultiSelect
          label="Tipo"
          values={filters.type}
          onChange={(v) => setFilters((f) => ({ ...f, type: v as TxType[] }))}
          options={[
            { value: 'income', label: 'Entradas' },
            { value: 'expense', label: 'Saídas' },
          ]}
        />
        <MultiSelect
          label="Método"
          values={filters.method}
          onChange={(v) => setFilters((f) => ({ ...f, method: v as PaymentMethod[] }))}
          options={[
            { value: 'credit', label: 'Crédito' },
            { value: 'debit', label: 'Débito' },
            { value: 'pix', label: 'PIX' },
            { value: 'cash', label: 'Dinheiro' },
          ]}
        />
        <MultiSelect
          label="Categoria"
          values={filters.category}
          onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
          options={categoryNames.map((c) => ({ value: c, label: c }))}
        />
        <MultiSelect
          label="Mês"
          values={filters.expenseMonth}
          onChange={(v) => setFilters((f) => ({ ...f, expenseMonth: v }))}
          options={months.map((m) => ({ value: m, label: formatMonthBR(m) }))}
        />
      </div>

      {/* Tabela */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead label="Descrição" sortKey="description" sort={sort} onToggle={toggleSort} />
              <SortHead label="Categoria" sortKey="category" sort={sort} onToggle={toggleSort} />
              <SortHead label="Método" sortKey="payment_method" sort={sort} onToggle={toggleSort} />
              <SortHead label="Data" sortKey="transaction_date" sort={sort} onToggle={toggleSort} />
              <SortHead label="Mês gasto" sortKey="expense_month" sort={sort} onToggle={toggleSort} />
              <SortHead label="Mês fatura" sortKey="billing_month" sort={sort} onToggle={toggleSort} />
              <SortHead label="Valor" sortKey="amount" sort={sort} onToggle={toggleSort} align="right" />
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  Nada por aqui
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium max-w-[260px] truncate" title={t.description}>
                    {t.description}
                    {t.is_recurring && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">REC</Badge>
                    )}
                    {t.is_installment && (
                      <Badge variant="outline" className="ml-2 text-[10px]">
                        {t.installment_number}/{t.total_installments}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell className="capitalize">{t.payment_method}</TableCell>
                  <TableCell>{formatDateBR(t.transaction_date)}</TableCell>
                  <TableCell>{formatMonthBR(t.expense_month)}</TableCell>
                  <TableCell>{formatMonthBR(t.billing_month)}</TableCell>
                  <TableCell
                    className={`text-right font-mono ${
                      t.type === 'income' ? 'text-money-up' : 'text-money-down'
                    }`}
                  >
                    {formatBRL(t.amount)}
                  </TableCell>
                  <TableCell>
                    {t.is_paid ? (
                      <Badge
                        variant="secondary"
                        className="bg-money-up/15 text-money-up border-money-up/30"
                      >
                        Pago
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title={t.is_paid ? 'Marcar pendente' : 'Marcar pago'}
                        onClick={() => togglePaid(t)}
                        disabled={pending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        title="Editar"
                        onClick={() => setEditing(t)}
                        disabled={pending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-money-down hover:text-red-300"
                        title="Excluir"
                        onClick={() => remove(t)}
                        disabled={pending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
