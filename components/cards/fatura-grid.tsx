'use client';

import { useMemo, useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Circle, CircleDot } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatBRL, formatMonthBR, addMonthsToISO } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CardRow, TransactionRow, Database } from '@/lib/supabase/types';

type PaidStatus = 'all' | 'partial' | 'none' | 'empty';

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

  // Três maps:
  //  - `lumpGrid`: faturas principais (`category='Cartão'` sem parênteses) — o "resto" não-itemizado.
  //  - `itemizedGrid`: tudo que tem card_id E billing_month preenchidos e não é fatura principal.
  //  - `paidGrid`: ids de tudo que conta na fatura (lump + itemized expense) + contagem de pagas,
  //    pra propagar status de pagamento em cascata por cartão+mês.
  const { lumpGrid, itemizedGrid, paidGrid } = useMemo(() => {
    const lump = new Map<string, { sum: number; ids: string[] }>();
    const itemized = new Map<string, number>();
    const paid = new Map<string, { ids: string[]; paidCount: number }>();
    for (const t of transactions) {
      if (!t.card_id || !t.billing_month) continue;
      const key = `${t.card_id}-${t.billing_month}`;
      const isLump = t.category === 'Cartão' && !t.description.includes('(');
      if (isLump) {
        const cur = lump.get(key) ?? { sum: 0, ids: [] };
        cur.sum += Math.abs(Number(t.amount));
        cur.ids.push(t.id);
        lump.set(key, cur);
      } else {
        if (t.type !== 'expense') continue;
        itemized.set(key, (itemized.get(key) ?? 0) + Math.abs(Number(t.amount)));
      }
      if (!isLump && t.type !== 'expense') continue;
      const p = paid.get(key) ?? { ids: [], paidCount: 0 };
      p.ids.push(t.id);
      if (t.is_paid) p.paidCount += 1;
      paid.set(key, p);
    }
    return { lumpGrid: lump, itemizedGrid: itemized, paidGrid: paid };
  }, [transactions]);

  const cellLump = (cardId: string, month: string) => lumpGrid.get(`${cardId}-${month}`)?.sum ?? 0;
  const cellItemized = (cardId: string, month: string) =>
    itemizedGrid.get(`${cardId}-${month}`) ?? 0;
  const cellTotal = (cardId: string, month: string) =>
    cellLump(cardId, month) + cellItemized(cardId, month);
  const cellPaidStatus = (cardId: string, month: string): PaidStatus => {
    const p = paidGrid.get(`${cardId}-${month}`);
    if (!p || p.ids.length === 0) return 'empty';
    if (p.paidCount === p.ids.length) return 'all';
    if (p.paidCount === 0) return 'none';
    return 'partial';
  };

  const monthTotals = useMemo(
    () =>
      months.map((m) => {
        let total = 0;
        for (const c of cards) total += cellTotal(c.id, m);
        return total;
      }),
    [months, cards, lumpGrid, itemizedGrid],
  );
  const grandTotal = monthTotals.reduce((a, b) => a + b, 0);

  const cardYearTotal = (cardId: string) =>
    months.reduce((a, m) => a + cellTotal(cardId, m), 0);

  const togglePaidCell = async (cardId: string, billingMonth: string, status: PaidStatus) => {
    const p = paidGrid.get(`${cardId}-${billingMonth}`);
    if (!p || p.ids.length === 0) return;
    const newPaid = status !== 'all'; // mark all paid; if already all paid, unmark
    const supabase = createClient();
    const { error } = await supabase
      .from('transactions')
      .update({ is_paid: newPaid })
      .in('id', p.ids);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      newPaid
        ? `Fatura paga · ${p.ids.length} ${p.ids.length === 1 ? 'lançamento' : 'lançamentos'}`
        : `Fatura marcada como pendente`,
    );
    startTransition(() => router.refresh());
  };

  const saveCell = async (card: CardRow, billingMonth: string, newTotal: number) => {
    const cellKey = `${card.id}-${billingMonth}`;
    const itemized = cellItemized(card.id, billingMonth);
    // O user digita o TOTAL da fatura; o app armazena só o "resto" (= total - itemizados),
    // pra evitar dupla contagem com lançamentos individuais que já têm card_id.
    const newLump = +(newTotal - itemized).toFixed(2);
    if (newLump < 0) {
      toast.error(
        `Total não pode ser menor que ${formatBRL(itemized)} (já lançado individualmente neste mês)`,
      );
      return;
    }
    setSavingCell(cellKey);
    try {
      const supabase = createClient();
      const existing = lumpGrid.get(cellKey);

      if (newLump === 0) {
        // Remove a linha agregada — o total da fatura é coberto 100% pelos itemizados.
        if (existing && existing.ids.length > 0) {
          const { error } = await supabase
            .from('transactions')
            .delete()
            .in('id', existing.ids);
          if (error) throw error;
          toast.success('Fatura coberta pelos itemizados');
        }
      } else if (existing && existing.ids.length > 0) {
        // Atualiza a primeira, remove duplicatas
        const [first, ...rest] = existing.ids;
        const { error: updErr } = await supabase
          .from('transactions')
          .update({ amount: -newLump })
          .eq('id', first);
        if (updErr) throw updErr;
        if (rest.length > 0) {
          await supabase.from('transactions').delete().in('id', rest);
        }
        toast.success(`${card.name} ${formatMonthBR(billingMonth)} → ${formatBRL(newTotal)}`);
      } else {
        // Insert novo
        type Insert = Database['public']['Tables']['transactions']['Insert'];
        const payload: Insert = {
          user_id: userId,
          description: `Cartão ${card.name}`,
          amount: -newLump,
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
        toast.success(`${card.name} ${formatMonthBR(billingMonth)} → ${formatBRL(newTotal)}`);
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
                  const total = cellTotal(card.id, m);
                  const itemized = cellItemized(card.id, m);
                  const paidStatus = cellPaidStatus(card.id, m);
                  const cellKey = `${card.id}-${m}`;
                  return (
                    <FaturaCell
                      key={m}
                      total={total}
                      itemized={itemized}
                      paidStatus={paidStatus}
                      isToday={m === todayKey}
                      isSaving={savingCell === cellKey}
                      disabled={pending}
                      onSave={(v) => saveCell(card, m, v)}
                      onTogglePaid={() => togglePaidCell(card.id, m, paidStatus)}
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
        Clique numa célula e digite o <strong>total</strong> da fatura — o app desconta automaticamente
        o que já foi lançado item-por-item naquele cartão/mês (parcelas, recorrentes, assinaturas).
        A linha de baixo (<span className="not-italic">↳ N item.</span>) mostra quanto já está itemizado.
      </p>
    </section>
  );
}

function FaturaCell({
  total,
  itemized,
  paidStatus,
  isToday,
  isSaving,
  disabled,
  onSave,
  onTogglePaid,
}: {
  total: number;
  itemized: number;
  paidStatus: PaidStatus;
  isToday: boolean;
  isSaving: boolean;
  disabled: boolean;
  onSave: (v: number) => void;
  onTogglePaid: () => void;
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
    setDraft(total > 0 ? String(total) : '');
    setEditing(true);
  };

  const commit = () => {
    const cleaned = draft.replace(/\./g, '').replace(',', '.').trim();
    const num = cleaned === '' ? 0 : Number(cleaned);
    if (Number.isFinite(num) && num >= 0 && Math.abs(num - total) > 0.001) {
      onSave(Math.round(num * 100) / 100);
    }
    setEditing(false);
  };

  const cancel = () => {
    setDraft(total > 0 ? String(total) : '');
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
          title={
            itemized > 0
              ? `Digite o TOTAL da fatura. Já lançado individualmente: ${formatBRL(itemized)}`
              : 'Total da fatura'
          }
        />
      </td>
    );
  }

  const showPaidToggle = paidStatus !== 'empty';
  const paidTitle =
    paidStatus === 'all'
      ? 'Fatura paga — clique pra desmarcar tudo'
      : paidStatus === 'partial'
        ? 'Pago parcial — clique pra marcar tudo como pago'
        : 'Pendente — clique pra marcar tudo como pago';

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
      title={
        itemized > 0
          ? `Total ${formatBRL(total)} · ${formatBRL(itemized)} já lançado item-por-item`
          : undefined
      }
    >
      <div className="flex items-center justify-end gap-1.5">
        {showPaidToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePaid();
            }}
            disabled={disabled || isSaving}
            title={paidTitle}
            className={cn(
              'shrink-0 rounded-full p-0.5 transition-colors',
              paidStatus === 'all'
                ? 'text-money-up hover:text-money-up/70'
                : paidStatus === 'partial'
                  ? 'text-accent-warm hover:text-foreground'
                  : 'text-muted-foreground/40 hover:text-foreground',
            )}
          >
            {paidStatus === 'all' ? (
              <Check className="h-3 w-3" />
            ) : paidStatus === 'partial' ? (
              <CircleDot className="h-3 w-3" />
            ) : (
              <Circle className="h-3 w-3" />
            )}
          </button>
        )}
        <div className="flex flex-col items-end leading-tight">
          <span
            className={cn(
              'tabular-nums hover:text-foreground transition-colors',
              total === 0 ? 'text-muted-foreground/30' : 'text-money-down',
            )}
          >
            {total === 0 ? '·' : formatNum(total)}
          </span>
          {itemized > 0 && (
            <span className="text-[9px] text-muted-foreground/70 italic tabular-nums">
              ↳ {formatNum(itemized)} item.
            </span>
          )}
        </div>
      </div>
    </td>
  );
}

function formatNum(v: number): string {
  if (v === 0) return '—';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
