'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { CategoryPieChart } from '@/components/charts/category-pie-chart';
import { CATEGORY_COLOR } from '@/lib/domain/categories';
import {
  CARD_BILL_PLANNED_HINT,
  aggregateByCategory,
  isActive,
  isCardBill,
  parseBRLInput,
} from '@/lib/domain/planned';
import { formatBRL, formatMonthBR } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { TransactionRow } from '@/lib/supabase/types';

export function CategoryView({
  transactions,
  onToggleActive,
  onChanged,
}: {
  transactions: TransactionRow[];
  onToggleActive: (t: TransactionRow) => void;
  onChanged: () => void;
}) {
  const months = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) if (t.expense_month) set.add(t.expense_month);
    return [...set].sort();
  }, [transactions]);

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const [month, setMonth] = useState<string>(() =>
    months.includes(currentKey) ? currentKey : (months[months.length - 1] ?? currentKey),
  );
  const [includePlanned, setIncludePlanned] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  // Edições otimistas ficam atreladas ao array `transactions` em que foram feitas:
  // dados novos do servidor (após router.refresh) trazem outro array e as descartam.
  const [optimistic, setOptimistic] = useState<{
    base: TransactionRow[];
    map: Record<string, Partial<TransactionRow>>;
  }>({ base: transactions, map: {} });
  const patchAmount = (id: string, amount: number) =>
    setOptimistic((o) => {
      const map = o.base === transactions ? o.map : {};
      return { base: transactions, map: { ...map, [id]: { ...map[id], amount } } };
    });

  const rows = useMemo(
    () =>
      transactions
        .filter((t) => t.expense_month === month)
        .map((t) => {
          const patch = optimistic.base === transactions ? optimistic.map[t.id] : undefined;
          return { ...t, ...patch } as TransactionRow;
        }),
    [transactions, month, optimistic],
  );

  const agg = useMemo(() => aggregateByCategory(rows, { includePlanned }), [rows, includePlanned]);
  const effectiveSelected =
    selected && agg.slices.some((s) => s.category === selected) ? selected : null;
  const sliceTotal = agg.slices.reduce((a, s) => a + s.value, 0);

  const grouped = useMemo(() => {
    const byCat = new Map<string, TransactionRow[]>();
    for (const t of rows) {
      if (t.type !== 'expense') continue;
      if (effectiveSelected && t.category !== effectiveSelected) continue;
      byCat.set(t.category, [...(byCat.get(t.category) ?? []), t]);
    }
    const order = new Map(agg.slices.map((s, i) => [s.category, i]));
    return [...byCat.entries()].sort(
      (a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999),
    );
  }, [rows, effectiveSelected, agg.slices]);

  const saveAmount = async (t: TransactionRow, raw: string) => {
    const parsed = parseBRLInput(raw);
    if (parsed === null) {
      toast.error('Valor inválido');
      return;
    }
    const next = -Math.abs(parsed); // despesas são gravadas negativas
    if (next === Number(t.amount)) return;
    patchAmount(t.id, next);
    const supabase = createClient();
    const { error } = await supabase.from('transactions').update({ amount: next }).eq('id', t.id);
    if (error) {
      patchAmount(t.id, Number(t.amount));
      toast.error(error.message);
    } else {
      onChanged();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
          aria-label="Mês"
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setSelected(null);
          }}
        >
          {(months.length ? months : [month]).map((m) => (
            <option key={m} value={m}>
              {formatMonthBR(m)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={includePlanned} onCheckedChange={setIncludePlanned} />
          Incluir previstos
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CategoryPieChart data={agg.slices} />
            <ul className="space-y-1">
              {agg.slices.map((s) => (
                <li key={s.category}>
                  <button
                    type="button"
                    aria-pressed={effectiveSelected === s.category}
                    onClick={() => setSelected((cur) => (cur === s.category ? null : s.category))}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-muted',
                      effectiveSelected === s.category && 'bg-muted font-medium',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background:
                            CATEGORY_COLOR[s.category as keyof typeof CATEGORY_COLOR] ?? '#8a8580',
                        }}
                      />
                      {s.category}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatBRL(s.value)}{' '}
                      <span className="text-muted-foreground">
                        {sliceTotal > 0 ? `${Math.round((s.value / sliceTotal) * 100)}%` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t pt-3 text-sm">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Ativos</span>
                <span className="font-mono">{formatBRL(agg.activeTotal)}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Previstos</span>
                <span className="font-mono">{formatBRL(agg.plannedTotal)}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {grouped.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma despesa neste mês
            </p>
          )}
          {grouped.map(([category, list]) => {
            const sub = aggregateByCategory(list, { includePlanned });
            return (
              <section key={category} className="rounded-md border">
                <header className="flex items-center justify-between border-b px-3 py-2">
                  <h3 className="text-sm font-medium">{category}</h3>
                  {sub.slices.length === 0 && sub.plannedTotal > 0 ? (
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {formatBRL(sub.plannedTotal)} previsto
                    </span>
                  ) : (
                    <span className="font-mono text-sm tabular-nums">
                      {formatBRL(sub.slices[0]?.value ?? 0)}
                    </span>
                  )}
                </header>
                <ul className="divide-y">
                  {list.map((t) => (
                    <li
                      key={t.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2',
                        !isActive(t) && 'opacity-55',
                      )}
                    >
                      <Switch
                        size="sm"
                        checked={isActive(t)}
                        onCheckedChange={() => onToggleActive(t)}
                        disabled={isCardBill(t) && isActive(t)}
                        title={isCardBill(t) && isActive(t) ? CARD_BILL_PLANNED_HINT : undefined}
                        aria-label={isActive(t) ? 'Marcar como previsto' : 'Ativar'}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm" title={t.description}>
                        {t.description}
                        {t.is_recurring && (
                          <Badge variant="secondary" className="ml-2 text-[10px]">REC</Badge>
                        )}
                        {t.is_installment && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {t.installment_number}/{t.total_installments}
                          </Badge>
                        )}
                        {!isActive(t) && (
                          <Badge variant="outline" className="ml-2 text-[10px]">Previsto</Badge>
                        )}
                      </span>
                      <Input
                        key={`${t.id}-${t.amount}`}
                        className="h-8 w-28 text-right font-mono"
                        defaultValue={Math.abs(Number(t.amount)).toFixed(2).replace('.', ',')}
                        onBlur={(e) => saveAmount(t, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                        inputMode="decimal"
                        aria-label={`Valor de ${t.description}`}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
