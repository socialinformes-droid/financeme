'use client';

import { useMemo, useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatBRL, formatMonthBR, addMonthsToISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CardRow, TransactionRow, Database } from '@/lib/supabase/types';

export function FaturaGrid({
  userId,
  cards,
  transactions,
  year,
}: {
  userId: string;
  cards: CardRow[];
  transactions: TransactionRow[];
  year: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingCell, setSavingCell] = useState<string | null>(null);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}-01`),
    [year],
  );

  const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  // Cell key: `${cardId}-${billingMonth}` → soma dos amounts (apenas faturas principais)
  const grid = useMemo(() => {
    const map = new Map<string, { sum: number; ids: string[] }>();
    for (const t of transactions) {
      if (!t.card_id || !t.billing_month) continue;
      if (t.category !== 'Cartão') continue;
      // só faturas principais — ignora "Cartão (Netflix)" etc
      if (t.description.includes('(')) continue;
      const key = `${t.card_id}-${t.billing_month}`;
      const cur = map.get(key) ?? { sum: 0, ids: [] };
      cur.sum += Math.abs(Number(t.amount));
      cur.ids.push(t.id);
      map.set(key, cur);
    }
    return map;
  }, [transactions]);

  const cellValue = (cardId: string, month: string) => grid.get(`${cardId}-${month}`)?.sum ?? 0;

  const monthTotals = useMemo(
    () =>
      months.map((m) => {
        let total = 0;
        for (const c of cards) total += cellValue(c.id, m);
        return total;
      }),
    [months, cards, grid],
  );
  const grandTotal = monthTotals.reduce((a, b) => a + b, 0);

  const cardYearTotal = (cardId: string) =>
    months.reduce((a, m) => a + cellValue(cardId, m), 0);

  const saveCell = async (card: CardRow, billingMonth: string, newAmount: number) => {
    const cellKey = `${card.id}-${billingMonth}`;
    setSavingCell(cellKey);
    try {
      const supabase = createClient();
      const existing = grid.get(cellKey);

      if (newAmount === 0) {
        // Remove fatura(s) da célula
        if (existing && existing.ids.length > 0) {
          const { error } = await supabase
            .from('transactions')
            .delete()
            .in('id', existing.ids);
          if (error) throw error;
          toast.success('Fatura removida');
        }
      } else if (existing && existing.ids.length > 0) {
        // Atualiza a primeira, remove duplicatas
        const [first, ...rest] = existing.ids;
        const { error: updErr } = await supabase
          .from('transactions')
          .update({ amount: -newAmount })
          .eq('id', first);
        if (updErr) throw updErr;
        if (rest.length > 0) {
          await supabase.from('transactions').delete().in('id', rest);
        }
        toast.success(`${card.name} ${formatMonthBR(billingMonth)} → ${formatBRL(newAmount)}`);
      } else {
        // Insert novo
        type Insert = Database['public']['Tables']['transactions']['Insert'];
        const payload: Insert = {
          user_id: userId,
          description: `Cartão ${card.name}`,
          amount: -newAmount,
          type: 'expense',
          payment_method: 'debit',
          category: 'Cartão',
          expense_month: billingMonth,
          billing_month: billingMonth,
          card_id: card.id,
          notes: null,
          is_recurring: false,
          is_paid: billingMonth < todayKey,
          transaction_date: billingMonth,
          is_installment: false,
          installment_number: null,
          total_installments: null,
          installment_group_id: null,
          installment_end_date: null,
        };
        const { error } = await supabase.from('transactions').insert(payload);
        if (error) throw error;
        toast.success(`${card.name} ${formatMonthBR(billingMonth)} → ${formatBRL(newAmount)}`);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSavingCell(null);
    }
  };

  if (cards.length === 0) return null;

  return (
    <section>
      <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
        <div>
          <p className="eyebrow mb-1">Caderno principal</p>
          <h3 className="headline text-2xl font-medium tracking-tight">Faturas mensais</h3>
        </div>
        <p className="text-xs italic text-muted-foreground pb-1">
          Edite a célula · soma reflete em "Cartão" da aba lançamentos
        </p>
      </div>

      <div className="rounded-md border border-rule/70 bg-card overflow-x-auto">
        <table className="w-full text-xs font-mono border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-paper-dark/95 backdrop-blur px-4 py-2.5 text-left font-medium border-b-2 border-rule/80 min-w-[140px]">
                <span className="eyebrow">Cartão</span>
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className={cn(
                    'px-2 py-2.5 text-right font-medium whitespace-nowrap border-b-2 border-rule/80',
                    m === todayKey && 'bg-accent/30',
                  )}
                >
                  <span className="font-display italic">{formatMonthBR(m)}</span>
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-medium whitespace-nowrap bg-paper-dark/60 border-b-2 border-rule/80">
                <span className="eyebrow">Ano</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => (
              <tr key={card.id} className="hover:bg-paper-dark/15">
                <td className="sticky left-0 z-10 bg-card px-4 py-2 border-b border-rule/30">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full shrink-0"
                      style={{ background: card.color ?? '#737373' }}
                    />
                    <span className="font-medium text-foreground/85">{card.name}</span>
                  </span>
                </td>
                {months.map((m) => {
                  const value = cellValue(card.id, m);
                  const cellKey = `${card.id}-${m}`;
                  return (
                    <FaturaCell
                      key={m}
                      value={value}
                      isToday={m === todayKey}
                      isSaving={savingCell === cellKey}
                      disabled={pending}
                      onSave={(v) => saveCell(card, m, v)}
                    />
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums bg-paper-dark/30 font-medium text-foreground/80 border-b border-rule/30">
                  {cardYearTotal(card.id) === 0
                    ? '—'
                    : formatNum(cardYearTotal(card.id))}
                </td>
              </tr>
            ))}
            {/* Total row */}
            <tr className="bg-paper-dark/50 font-medium border-double">
              <td className="sticky left-0 z-10 bg-paper-dark/95 backdrop-blur px-4 py-3 border-t-2 border-double border-rule">
                <span className="font-display text-sm italic">Total Cartão</span>
              </td>
              {monthTotals.map((v, i) => (
                <td
                  key={months[i]}
                  className={cn(
                    'px-2 py-3 text-right tabular-nums border-t-2 border-double border-rule font-medium text-money-down',
                    months[i] === todayKey && 'bg-accent/40',
                    v === 0 && 'text-muted-foreground/40',
                  )}
                >
                  {v === 0 ? '—' : formatNum(v)}
                </td>
              ))}
              <td className="px-3 py-3 text-right tabular-nums bg-paper-dark/80 border-t-2 border-double border-rule font-semibold text-money-down">
                {formatNum(grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground italic px-1">
        Clique numa célula para editar. Apague o valor (ou digite 0) para remover a fatura. Subscrições isoladas (Netflix, etc.) não aparecem aqui — só faturas principais.
      </p>
    </section>
  );
}

function FaturaCell({
  value,
  isToday,
  isSaving,
  disabled,
  onSave,
}: {
  value: number;
  isToday: boolean;
  isSaving: boolean;
  disabled: boolean;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = () => {
    if (disabled || isSaving) return;
    setDraft(value > 0 ? String(value) : '');
    setEditing(true);
  };

  const commit = () => {
    const cleaned = draft.replace(/\./g, '').replace(',', '.').trim();
    const num = cleaned === '' ? 0 : Number(cleaned);
    if (Number.isFinite(num) && num >= 0 && Math.abs(num - value) > 0.001) {
      onSave(Math.round(num * 100) / 100);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value > 0 ? String(value) : '');
    setEditing(false);
  };

  if (editing) {
    return (
      <td
        className={cn(
          'px-1 py-1 text-right border-b border-rule/30',
          isToday && 'bg-accent/30',
        )}
      >
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
            if (e.key === 'Tab') commit();
          }}
          className="w-full text-right font-mono tabular-nums bg-card border border-foreground/30 rounded-sm px-1.5 py-1 text-xs outline-none focus:border-foreground/60"
        />
      </td>
    );
  }

  return (
    <td
      className={cn(
        'px-2 py-2 text-right border-b border-rule/30 cursor-pointer transition-colors',
        isToday && 'bg-accent/20',
        isSaving && 'opacity-50',
      )}
      onClick={startEdit}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startEdit();
        }
      }}
    >
      <span
        className={cn(
          'tabular-nums hover:text-foreground transition-colors',
          value === 0 ? 'text-muted-foreground/30' : 'text-money-down',
        )}
      >
        {value === 0 ? '·' : formatNum(value)}
      </span>
    </td>
  );
}

function formatNum(v: number): string {
  if (v === 0) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
