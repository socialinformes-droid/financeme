'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Pencil, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES } from '@/lib/domain/categories';
import { formatBRL, formatMonthBR } from '@/lib/format';
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
import type { RecurringIncomeRow, BudgetRow } from '@/lib/supabase/types';

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
  transactionCount,
}: {
  userId: string;
  incomes: RecurringIncomeRow[];
  budgets: BudgetRow[];
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

      <RecurringIncomeSection userId={userId} incomes={incomes} pending={pending} onChange={refresh} />
      <BudgetsSection userId={userId} budgets={budgets} pending={pending} onChange={refresh} />
      <ExportSection />
      <CategoriesInfo />
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
  pending,
  onChange,
}: {
  userId: string;
  budgets: BudgetRow[];
  pending: boolean;
  onChange: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState('Alimentação');
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
                  {CATEGORIES.filter((c) => c !== 'Salário' && c !== 'Reembolso' && c !== 'Freela').map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
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

// ─── Categorias (info) ─────────────────────────────────────────────────────
function CategoriesInfo() {
  return (
    <section>
      <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
        <div>
          <p className="eyebrow mb-1">Editorial</p>
          <h3 className="headline text-2xl font-medium tracking-tight">Categorias</h3>
        </div>
        <p className="text-xs italic text-muted-foreground pb-1">
          fixas no código · {CATEGORIES.length} categorias
        </p>
      </div>
      <div className="rounded-md border border-rule/60 bg-card p-4">
        <p className="text-sm text-muted-foreground italic mb-3">
          Lista atual de categorias disponíveis. Pra adicionar/remover, edite{' '}
          <code className="font-mono text-xs px-1 py-0.5 rounded bg-muted/40 not-italic">lib/domain/categories.ts</code>.
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <li
              key={c}
              className="text-[11px] px-2 py-0.5 rounded-full bg-paper-dark/50 border border-rule/50"
            >
              {c}
            </li>
          ))}
        </ul>
      </div>
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
