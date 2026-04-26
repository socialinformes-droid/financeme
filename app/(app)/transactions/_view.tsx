'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Trash2, CheckCircle2, Pencil, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES } from '@/lib/domain/categories';
import { formatBRL, formatDateBR, formatMonthBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { TransactionRow, CardRow } from '@/lib/supabase/types';

type Filters = {
  q: string;
  type: 'all' | 'income' | 'expense';
  method: 'all' | 'credit' | 'debit' | 'pix' | 'cash';
  status: 'all' | 'paid' | 'pending';
  category: string;
  expenseMonth: string;
};

const ALL = '__all';

export function TransactionsView({
  userId,
  initialTransactions,
  cards,
}: {
  userId: string;
  initialTransactions: TransactionRow[];
  cards: CardRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionRow | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    q: '',
    type: 'all',
    method: 'all',
    status: 'all',
    category: ALL,
    expenseMonth: ALL,
  });

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const t of initialTransactions) if (t.expense_month) set.add(t.expense_month);
    return [...set].sort().reverse();
  }, [initialTransactions]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return initialTransactions.filter((t) => {
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      if (filters.method !== 'all' && t.payment_method !== filters.method) return false;
      if (filters.status === 'paid' && !t.is_paid) return false;
      if (filters.status === 'pending' && t.is_paid) return false;
      if (filters.category !== ALL && t.category !== filters.category) return false;
      if (filters.expenseMonth !== ALL && t.expense_month !== filters.expenseMonth) return false;
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
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Transações</h2>
          <p className="text-sm text-muted-foreground">
            {totals.count} lançamentos · entradas {formatBRL(totals.income)} · saídas{' '}
            {formatBRL(totals.expense)} · saldo{' '}
            <span className={totals.balance >= 0 ? 'text-green-400' : 'text-red-400'}>
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
        <Select
          value={filters.type}
          onValueChange={(v) => setFilters((f) => ({ ...f, type: (v as Filters['type']) ?? 'all' }))}
        >
          <SelectTrigger className="w-full"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tipo: todos</SelectItem>
            <SelectItem value="income">Entradas</SelectItem>
            <SelectItem value="expense">Saídas</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.method}
          onValueChange={(v) => setFilters((f) => ({ ...f, method: (v as Filters['method']) ?? 'all' }))}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Método: todos</SelectItem>
            <SelectItem value="credit">Crédito</SelectItem>
            <SelectItem value="debit">Débito</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="cash">Dinheiro</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filters.category}
          onValueChange={(v) => setFilters((f) => ({ ...f, category: v ?? ALL }))}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Categoria: todas</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.expenseMonth}
          onValueChange={(v) => setFilters((f) => ({ ...f, expenseMonth: v ?? ALL }))}
        >
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mês: todos</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{formatMonthBR(m)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Mês gasto</TableHead>
              <TableHead>Mês fatura</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  Nada por aqui
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
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
                      t.type === 'income' ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {formatBRL(t.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.is_paid ? 'default' : 'secondary'}>
                      {t.is_paid ? 'Pago' : 'Pendente'}
                    </Badge>
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
                        className="h-7 w-7 text-red-400 hover:text-red-300"
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
