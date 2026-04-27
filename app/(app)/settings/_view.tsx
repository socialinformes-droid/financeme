'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Pencil, Download } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CATEGORIES } from '@/lib/domain/categories';
import { formatBRL, formatMonthBR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  RecurringIncomeRow,
  BudgetRow,
  CategoryRow,
} from '@/lib/supabase/types';

const PRESET_COLORS = [
  '#5a7d4f', '#7a9a5a', '#5a8a8a', '#3f7a7a',
  '#4e6e8e', '#6b4f7a', '#7a5a9a', '#a85e7a',
  '#b76e54', '#a84e3e', '#a8862e', '#8a6240',
  '#5e6e8e', '#6e7a4e', '#7a7268', '#5a5e68',
  '#8a8580',
];

const MONTHS = [
  { value: 1, label: 'jan' }, { value: 2, label: 'fev' }, { value: 3, label: 'mar' },
  { value: 4, label: 'abr' }, { value: 5, label: 'mai' }, { value: 6, label: 'jun' },
  { value: 7, label: 'jul' }, { value: 8, label: 'ago' }, { value: 9, label: 'set' },
  { value: 10, label: 'out' }, { value: 11, label: 'nov' }, { value: 12, label: 'dez' },
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export function SettingsView({
  userId,
  incomes,
  budgets,
  categories,
  transactionCount,
}: {
  userId: string;
  incomes: RecurringIncomeRow[];
  budgets: BudgetRow[];
  categories: CategoryRow[];
  transactionCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="space-y-10">
      <header className="pb-4 border-b border-rule/60">
        <p className="eyebrow">Caderno de</p>
        <h2 className="headline text-4xl font-light tracking-tight">Edição</h2>
        <p className="text-xs italic text-muted-foreground mt-1.5">
          Configurações do almanaque · {transactionCount} lançamentos no total
        </p>
      </header>

      <CategoriesSection userId={userId} categories={categories} pending={pending} onChange={refresh} />
      <RecurringIncomeSection userId={userId} incomes={incomes} pending={pending} onChange={refresh} />
      <BudgetsSection userId={userId} budgets={budgets} categories={categories} pending={pending} onChange={refresh} />
      <ExportSection />
    </div>
  );
}

// ─── Renda recorrente ──────────────────────────────────────────────────────
function RecurringIncomeSection({
  userId,
  incomes,
  pending,
  onChange,
}: {
  userId: string;
  incomes: RecurringIncomeRow[];
  pending: boolean;
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState(0);
  const [day, setDay] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const addIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amount) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('recurring_income').insert({
        user_id: userId,
        description: desc.trim(),
        amount,
        day_of_month: day,
        is_active: true,
      });
      if (error) throw error;
      toast.success('Renda adicionada');
      setDesc(''); setAmount(0); setDay(5); setShowForm(false);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = async (i: RecurringIncomeRow) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('recurring_income')
      .update({ is_active: !i.is_active })
      .eq('id', i.id);
    if (error) toast.error(error.message);
    else { toast.success(i.is_active ? 'Desativada' : 'Ativada'); onChange(); }
  };

  const remove = async (i: RecurringIncomeRow) => {
    if (!confirm(`Excluir "${i.description}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('recurring_income').delete().eq('id', i.id);
    if (error) toast.error(error.message);
    else { toast.success('Excluída'); onChange(); }
  };

  return (
    <section>
      <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
        <div>
          <p className="eyebrow mb-1">Editorial</p>
          <h3 className="headline text-2xl font-medium tracking-tight">Renda recorrente</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {showForm ? 'Cancelar' : 'Nova'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={addIncome} className="rounded-md border border-rule/60 bg-card p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="ri-desc">Descrição</Label>
              <Input
                id="ri-desc"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Salário, Freelance, Aluguel recebido..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dia do mês</Label>
              <Input
                type="number"
                min={1}
                max={31}
                value={day}
                onChange={(e) => setDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <Button type="submit" disabled={submitting || !desc.trim() || !amount} className="w-full">
                {submitting ? 'Salvando...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </form>
      )}

      {incomes.length === 0 ? (
        <p className="text-sm italic text-muted-foreground py-6 text-center">
          Nenhuma renda recorrente cadastrada.
        </p>
      ) : (
        <ul className="rounded-md border border-rule/60 bg-card divide-y divide-rule/40">
          {incomes.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${!i.is_active ? 'line-through text-muted-foreground' : ''}`}>
                  {i.description}
                </p>
                <p className="text-[11px] italic text-muted-foreground">
                  todo dia {i.day_of_month ?? '—'} · {i.is_active ? 'ativa' : 'pausada'}
                </p>
              </div>
              <span className="font-mono tabular-nums text-money-up">
                {formatBRL(Number(i.amount))}
              </span>
              <div className="flex gap-0.5">
                <Button size="icon-sm" variant="ghost" onClick={() => toggle(i)} disabled={pending}>
                  <span className="text-[10px]">{i.is_active ? '⏸' : '▶'}</span>
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => remove(i)}
                  disabled={pending}
                  className="text-money-down"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Orçamentos ────────────────────────────────────────────────────────────
function BudgetsSection({
  userId,
  budgets,
  categories,
  pending,
  onChange,
}: {
  userId: string;
  budgets: BudgetRow[];
  categories: CategoryRow[];
  pending: boolean;
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(categories[0]?.name ?? 'Alimentação');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(CURRENT_YEAR);
  const [amount, setAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const monthIso = `${year}-${String(month).padStart(2, '0')}-01`;
      const { error } = await supabase
        .from('budgets')
        .upsert({ user_id: userId, category, month: monthIso, amount }, { onConflict: 'user_id,category,month' });
      if (error) throw error;
      toast.success('Orçamento salvo');
      setAmount(0); setShowForm(false);
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (b: BudgetRow) => {
    if (!confirm(`Excluir orçamento de ${b.category} em ${formatMonthBR(b.month)}?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('budgets').delete().eq('id', b.id);
    if (error) toast.error(error.message);
    else { toast.success('Excluído'); onChange(); }
  };

  return (
    <section>
      <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
        <div>
          <p className="eyebrow mb-1">Editorial</p>
          <h3 className="headline text-2xl font-medium tracking-tight">Orçamentos</h3>
          <p className="text-[11px] italic text-muted-foreground mt-0.5">
            limite mensal por categoria
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((s) => !s)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {showForm ? 'Cancelar' : 'Novo'}
        </Button>
      </div>

      {showForm && (
        <form onSubmit={add} className="rounded-md border border-rule/60 bg-card p-4 mb-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? 'Alimentação')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories
                    .filter((c) => !['Salário', 'Reembolso', 'Freela'].includes(c.name))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mês</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v ?? '1'))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v ?? CURRENT_YEAR))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <Button type="submit" disabled={submitting || !amount} className="w-full">
            {submitting ? 'Salvando...' : 'Salvar orçamento'}
          </Button>
        </form>
      )}

      {budgets.length === 0 ? (
        <p className="text-sm italic text-muted-foreground py-6 text-center">
          Nenhum orçamento cadastrado.
        </p>
      ) : (
        <ul className="rounded-md border border-rule/60 bg-card divide-y divide-rule/40">
          {budgets.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{b.category}</p>
                <p className="text-[11px] italic text-muted-foreground">
                  {formatMonthBR(b.month)}
                </p>
              </div>
              <span className="font-mono tabular-nums">{formatBRL(Number(b.amount))}</span>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => remove(b)}
                disabled={pending}
                className="text-money-down"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────
function ExportSection() {
  const [downloading, setDownloading] = useState<'csv' | 'json' | null>(null);

  const downloadAll = async (format: 'csv' | 'json') => {
    setDownloading(format);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('transaction_date', { ascending: true });
      if (error) throw error;
      const rows = data ?? [];
      const today = new Date().toISOString().slice(0, 10);

      if (format === 'json') {
        downloadFile(`financeiro-${today}.json`, JSON.stringify(rows, null, 2), 'application/json');
      } else {
        const headers = [
          'transaction_date', 'expense_month', 'billing_month', 'description',
          'amount', 'type', 'payment_method', 'category', 'card_id',
          'is_recurring', 'is_paid', 'is_installment', 'installment_number',
          'total_installments', 'notes',
        ];
        const escape = (v: unknown): string => {
          if (v === null || v === undefined) return '';
          const s = String(v);
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        };
        const lines = [
          headers.join(','),
          ...rows.map((r) =>
            headers.map((h) => escape((r as unknown as Record<string, unknown>)[h])).join(','),
          ),
        ];
        downloadFile(`financeiro-${today}.csv`, lines.join('\n'), 'text/csv');
      }
      toast.success(`${rows.length} lançamentos exportados`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao exportar');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <section>
      <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
        <div>
          <p className="eyebrow mb-1">Editorial</p>
          <h3 className="headline text-2xl font-medium tracking-tight">Exportar</h3>
        </div>
        <p className="text-xs italic text-muted-foreground pb-1">
          baixar tudo localmente
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => downloadAll('csv')}
          disabled={downloading !== null}
          className="rounded-md border border-rule/60 bg-card p-4 text-left hover:border-rule transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3 mb-1">
            <Download className="h-4 w-4 text-foreground/70" />
            <p className="font-medium">CSV</p>
          </div>
          <p className="text-[11px] italic text-muted-foreground">
            Planilha · abre no Excel/Google Sheets
          </p>
        </button>
        <button
          type="button"
          onClick={() => downloadAll('json')}
          disabled={downloading !== null}
          className="rounded-md border border-rule/60 bg-card p-4 text-left hover:border-rule transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3 mb-1">
            <Download className="h-4 w-4 text-foreground/70" />
            <p className="font-medium">JSON</p>
          </div>
          <p className="text-[11px] italic text-muted-foreground">
            Backup completo · todos os campos
          </p>
        </button>
      </div>
    </section>
  );
}

// ─── Categorias (CRUD) ────────────────────────────────────────────────────
function CategoriesSection({
  userId,
  categories,
  pending,
  onChange,
}: {
  userId: string;
  categories: CategoryRow[];
  pending: boolean;
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);

  const startEdit = (c: CategoryRow) => {
    setEditing(c);
    setName(c.name);
    setColor(c.color ?? PRESET_COLORS[0]);
    setShowForm(true);
  };

  const startNew = () => {
    setEditing(null);
    setName('');
    setColor(PRESET_COLORS[0]);
    setShowForm(true);
  };

  const cancel = () => {
    setShowForm(false);
    setEditing(null);
    setName('');
  };

  const seedDefaults = async () => {
    if (!confirm('Adicionar as 17 categorias padrão? (não duplica as que já existem)')) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      // unique(user_id, name) garante idempotência via upsert ignoreDuplicates
      const rows = DEFAULT_CATEGORIES.map((d) => ({
        user_id: userId,
        name: d.name,
        color: d.color,
        is_active: true,
      }));
      const { error } = await supabase
        .from('categories')
        .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true });
      if (error) throw error;
      toast.success('Categorias padrão adicionadas');
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSubmitting(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      if (editing) {
        const { error } = await supabase
          .from('categories')
          .update({ name: name.trim(), color })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Categoria atualizada');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({ user_id: userId, name: name.trim(), color, is_active: true });
        if (error) throw error;
        toast.success('Categoria adicionada');
      }
      cancel();
      onChange();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro';
      toast.error(msg.includes('duplicate') ? 'Categoria com esse nome já existe' : msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (c: CategoryRow) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('categories')
      .update({ is_active: !c.is_active })
      .eq('id', c.id);
    if (error) toast.error(error.message);
    else {
      toast.success(c.is_active ? 'Pausada' : 'Reativada');
      onChange();
    }
  };

  const remove = async (c: CategoryRow) => {
    if (
      !confirm(
        `Excluir "${c.name}"? Lançamentos antigos com essa categoria continuam intactos (categoria fica como texto solto). Pra esconder sem perder histórico, use o ⏸.`,
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from('categories').delete().eq('id', c.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Excluída');
      onChange();
    }
  };

  const isEmpty = categories.length === 0;

  return (
    <section>
      <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
        <div>
          <p className="eyebrow mb-1">Editorial</p>
          <h3 className="headline text-2xl font-medium tracking-tight">Categorias</h3>
          <p className="text-[11px] italic text-muted-foreground mt-0.5">
            {categories.length} {categories.length === 1 ? 'categoria' : 'categorias'} · custom por user
          </p>
        </div>
        <div className="flex gap-2">
          {isEmpty && (
            <Button
              size="sm"
              variant="outline"
              onClick={seedDefaults}
              disabled={submitting}
            >
              Adicionar padrão
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={showForm ? cancel : startNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {showForm ? 'Cancelar' : 'Nova'}
          </Button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={save}
          className="rounded-md border border-rule/60 bg-card p-4 mb-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Pets, Viagem, Investimentos..."
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      'h-6 w-6 rounded-full transition-transform',
                      color === c
                        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110'
                        : 'hover:scale-110',
                    )}
                    style={{ background: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <Button type="submit" disabled={submitting || !name.trim()} className="w-full">
            {submitting ? 'Salvando...' : editing ? 'Atualizar' : 'Adicionar'}
          </Button>
        </form>
      )}

      {isEmpty ? (
        <div className="rounded-md border border-rule/60 bg-card p-6 text-center space-y-3">
          <p className="text-sm italic text-muted-foreground">
            Nenhuma categoria cadastrada ainda.
          </p>
          <p className="text-xs text-muted-foreground">
            Click em <strong>Adicionar padrão</strong> pra começar com as 17 categorias usuais (Salário, Cartão, Família etc), ou{' '}
            <strong>Nova</strong> pra criar uma do zero.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className={cn(
                'rounded-md border border-rule/60 bg-card px-3 py-2.5 flex items-center gap-2.5 group',
                !c.is_active && 'opacity-50',
              )}
            >
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ background: c.color ?? '#737373' }}
              />
              <span
                className={cn(
                  'flex-1 text-sm font-medium truncate',
                  !c.is_active && 'line-through',
                )}
                title={c.name}
              >
                {c.name}
              </span>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title={c.is_active ? 'Pausar' : 'Reativar'}
                  onClick={() => toggleActive(c)}
                  disabled={pending}
                >
                  <span className="text-[10px]">{c.is_active ? '⏸' : '▶'}</span>
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Editar"
                  onClick={() => startEdit(c)}
                  disabled={pending}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Excluir"
                  onClick={() => remove(c)}
                  disabled={pending}
                  className="text-money-down hover:text-money-down"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] italic text-muted-foreground">
        Lançamentos antigos guardam o nome da categoria como texto. Renomear não afeta histórico — vai aparecer com o novo nome em todos os lugares. Excluir deixa lançamentos antigos com o nome textual sem cor associada.
      </p>
    </section>
  );
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
