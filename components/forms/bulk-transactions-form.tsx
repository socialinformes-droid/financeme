'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Wand2, ArrowDown } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES } from '@/lib/domain/categories';
import { calculateBillingMonth } from '@/lib/domain/billing';
import { addMonthsToISO, formatBRL, formatMonthBR } from '@/lib/format';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { CardRow, Database } from '@/lib/supabase/types';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];
const MONTHS = [
  { value: 1, label: 'jan' },
  { value: 2, label: 'fev' },
  { value: 3, label: 'mar' },
  { value: 4, label: 'abr' },
  { value: 5, label: 'mai' },
  { value: 6, label: 'jun' },
  { value: 7, label: 'jul' },
  { value: 8, label: 'ago' },
  { value: 9, label: 'set' },
  { value: 10, label: 'out' },
  { value: 11, label: 'nov' },
  { value: 12, label: 'dez' },
];

type Row = { month: string; amount: number };

export type BulkTransactionsFormProps = {
  userId: string;
  cards: CardRow[];
  onDone?: () => void;
};

export function BulkTransactionsForm({ userId, cards, onDone }: BulkTransactionsFormProps) {
  const [submitting, setSubmitting] = useState(false);

  // Meta
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [paymentMethod, setPaymentMethod] = useState<'credit' | 'debit' | 'pix' | 'cash'>('debit');
  const [category, setCategory] = useState('Outros');
  const [cardId, setCardId] = useState<string | undefined>();
  const [notes, setNotes] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [defaultAmount, setDefaultAmount] = useState(0);

  // Período
  const [startYear, setStartYear] = useState(CURRENT_YEAR);
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 1);
  const [endYear, setEndYear] = useState(CURRENT_YEAR);
  const [endMonth, setEndMonth] = useState(12);

  // Grade de valores
  const months = useMemo(() => {
    const out: string[] = [];
    let y = startYear;
    let m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      out.push(`${y}-${String(m).padStart(2, '0')}-01`);
      m++;
      if (m > 12) { m = 1; y++; }
      if (out.length > 60) break; // safety
    }
    return out;
  }, [startYear, startMonth, endYear, endMonth]);

  const [rows, setRows] = useState<Row[]>([]);

  // Sincroniza linhas com o período (preserva valores já digitados)
  useEffect(() => {
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.month, r.amount]));
      return months.map((m) => ({ month: m, amount: map.get(m) ?? 0 }));
    });
  }, [months]);

  const totals = useMemo(() => {
    const filled = rows.filter((r) => r.amount > 0);
    const sum = filled.reduce((a, r) => a + r.amount, 0);
    return { count: filled.length, sum };
  }, [rows]);

  const applyToAll = () => {
    setRows((rs) => rs.map((r) => ({ ...r, amount: defaultAmount })));
  };

  const fillEmpty = () => {
    setRows((rs) => rs.map((r) => (r.amount > 0 ? r : { ...r, amount: defaultAmount })));
  };

  const fillFromIndex = (i: number) => {
    setRows((rs) => rs.map((r, idx) => (idx >= i ? { ...r, amount: defaultAmount } : r)));
  };

  const setAmountAt = (i: number, value: number) => {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, amount: value } : r)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Adicione uma descrição');
      return;
    }
    if (paymentMethod === 'credit' && !cardId) {
      toast.error('Selecione um cartão para crédito');
      return;
    }
    if (totals.count === 0) {
      toast.error('Preencha pelo menos um valor');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const card = cards.find((c) => c.id === cardId) ?? null;

      type TxInsert = Database['public']['Tables']['transactions']['Insert'];
      const inserts: TxInsert[] = rows
        .filter((r) => r.amount > 0)
        .map((r) => {
          const sign = type === 'income' ? 1 : -1;
          const txDate = new Date(`${r.month}T12:00:00`);
          const billing = calculateBillingMonth(txDate, paymentMethod, card);
          return {
            user_id: userId,
            description,
            amount: Math.abs(r.amount) * sign,
            type,
            payment_method: paymentMethod,
            category,
            notes: notes || null,
            expense_month: r.month,
            billing_month: billing,
            card_id: cardId ?? null,
            is_recurring: false,
            is_paid: isPaid,
            transaction_date: r.month,
            is_installment: false,
            installment_number: null,
            total_installments: null,
            installment_group_id: null,
            installment_end_date: null,
          };
        });

      // Insere em batches de 50
      for (let i = 0; i < inserts.length; i += 50) {
        const batch = inserts.slice(i, i + 50);
        const { error } = await supabase.from('transactions').insert(batch);
        if (error) throw error;
      }

      toast.success(`${inserts.length} lançamentos criados`);
      onDone?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Meta */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType((v as 'expense' | 'income') ?? 'expense')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Saída</SelectItem>
              <SelectItem value="income">Entrada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Método</Label>
          <Select
            value={paymentMethod}
            onValueChange={(v) =>
              setPaymentMethod((v as 'credit' | 'debit' | 'pix' | 'cash') ?? 'debit')
            }
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="debit">Débito</SelectItem>
              <SelectItem value="credit">Crédito</SelectItem>
              <SelectItem value="pix">PIX</SelectItem>
              <SelectItem value="cash">Dinheiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bulk-desc">Descrição</Label>
        <Input
          id="bulk-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ex: Mãe, Aluguel, Academia..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={(v) => setCategory(v ?? 'Outros')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {paymentMethod === 'credit' && (
          <div className="space-y-1.5">
            <Label>Cartão</Label>
            <Select value={cardId ?? ''} onValueChange={(v) => setCardId(v ?? undefined)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {cards.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    Cadastre um cartão (Fase 2)
                  </SelectItem>
                ) : (
                  cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bulk-notes">Observações (opcional)</Label>
        <Textarea id="bulk-notes" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
        <div>
          <p className="text-sm font-medium">Marcar como pago</p>
          <p className="text-xs text-muted-foreground">Aplica para todos os lançamentos criados</p>
        </div>
        <Switch checked={isPaid} onCheckedChange={setIsPaid} />
      </div>

      {/* Período */}
      <div className="rounded-md border border-border/60 p-3 space-y-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Período</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">De</Label>
            <div className="flex gap-1.5">
              <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(Number(v ?? '1'))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(startYear)} onValueChange={(v) => setStartYear(Number(v ?? CURRENT_YEAR))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Até</Label>
            <div className="flex gap-1.5">
              <Select value={String(endMonth)} onValueChange={(v) => setEndMonth(Number(v ?? '12'))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(endYear)} onValueChange={(v) => setEndYear(Number(v ?? CURRENT_YEAR))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs">Valor padrão (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={defaultAmount || ''}
              onChange={(e) => setDefaultAmount(Number(e.target.value) || 0)}
              placeholder="0,00"
            />
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyToAll}
              disabled={defaultAmount <= 0}
              title="Sobrescreve todos os meses com o valor padrão"
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Todos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fillEmpty}
              disabled={defaultAmount <= 0}
              title="Preenche apenas os meses zerados"
            >
              Vazios
            </Button>
          </div>
        </div>
      </div>

      {/* Grade de valores */}
      {rows.length > 0 && (
        <div className="rounded-md border border-border/60 max-h-72 overflow-y-auto">
          <ul className="divide-y divide-border/40">
            {rows.map((r, i) => {
              const isEmpty = r.amount === 0;
              return (
                <li
                  key={r.month}
                  className={`flex items-center gap-2 px-3 py-1.5 ${isEmpty ? 'opacity-60' : ''}`}
                >
                  <span className="w-16 text-xs text-muted-foreground font-mono">
                    {formatMonthBR(r.month)}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={r.amount || ''}
                    onChange={(e) => setAmountAt(i, Number(e.target.value) || 0)}
                    placeholder="—"
                    className="flex-1 h-7 text-sm font-mono"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title="Preencher daqui pra baixo com o valor padrão"
                    onClick={() => fillFromIndex(i)}
                    disabled={defaultAmount <= 0}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Resumo + submit */}
      <div className="rounded-md bg-muted/40 p-3 flex items-center justify-between">
        <div className="text-xs">
          <p className="text-muted-foreground">Vai criar</p>
          <p className="font-medium">
            {totals.count} {totals.count === 1 ? 'lançamento' : 'lançamentos'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p
            className={`font-mono font-semibold ${
              type === 'income' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {formatBRL(type === 'income' ? totals.sum : -totals.sum)}
          </p>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting || totals.count === 0}>
        {submitting ? 'Salvando...' : `Criar ${totals.count} ${totals.count === 1 ? 'lançamento' : 'lançamentos'}`}
      </Button>
    </form>
  );
}
