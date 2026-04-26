'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Search,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatBRL, formatMonthBR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ShoppingForm } from '@/components/forms/shopping-form';
import type { ShoppingItemRow } from '@/lib/supabase/types';

type Filters = {
  q: string;
  priority: 'all' | 'high' | 'medium' | 'low';
  category: string;
  status: 'all' | 'pending' | 'purchased';
};

type Forecast = {
  startMonth: string;
  totalForecast: number;
  monthlyBalance: Record<string, number>;
};

const ALL = '__all';
const PRIORITY_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: 'oklch(0.48 0.18 30)',
  medium: 'oklch(0.55 0.13 70)',
  low: 'oklch(0.55 0.04 60)',
};
const PRIORITY_LABEL = { high: 'Alta', medium: 'Média', low: 'Baixa' } as const;

export function ShoppingView({
  userId,
  initial,
  forecast,
}: {
  userId: string;
  initial: ShoppingItemRow[];
  forecast: Forecast;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItemRow | null>(null);
  const [filters, setFilters] = useState<Filters>({
    q: '',
    priority: 'all',
    category: ALL,
    status: 'pending',
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const i of initial) if (i.category) set.add(i.category);
    return [...set].sort();
  }, [initial]);

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return initial.filter((i) => {
      if (filters.priority !== 'all' && i.priority !== filters.priority) return false;
      if (filters.status === 'pending' && i.is_purchased) return false;
      if (filters.status === 'purchased' && !i.is_purchased) return false;
      if (filters.category !== ALL && i.category !== filters.category) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initial, filters]);

  // Função de "valor médio estimado"
  const avgPrice = (it: ShoppingItemRow): number => {
    const lo = Number(it.price_min ?? 0);
    const hi = Number(it.price_max ?? 0);
    if (!lo && !hi) return 0;
    if (!lo) return hi;
    if (!hi) return lo;
    return (lo + hi) / 2;
  };

  const totals = useMemo(() => {
    const pending = initial.filter((i) => !i.is_purchased);
    const sumMin = pending.reduce((a, i) => a + i.quantity * Number(i.price_min ?? 0), 0);
    const sumMax = pending.reduce((a, i) => a + i.quantity * Number(i.price_max ?? 0), 0);
    const sumAvg = pending.reduce((a, i) => a + i.quantity * avgPrice(i), 0);
    const highSum = pending
      .filter((i) => i.priority === 'high')
      .reduce((a, i) => a + i.quantity * avgPrice(i), 0);
    return { sumMin, sumMax, sumAvg, highSum, count: pending.length };
  }, [initial]);

  const simulationTotal = useMemo(() => {
    let sum = 0;
    for (const id of selected) {
      const item = initial.find((i) => i.id === id);
      if (!item) continue;
      sum += item.quantity * avgPrice(item);
    }
    return sum;
  }, [selected, initial]);

  const refresh = () => startTransition(() => router.refresh());

  const togglePurchased = async (i: ShoppingItemRow) => {
    let purchasedPrice: number | null = i.purchased_price ?? null;
    if (!i.is_purchased) {
      const suggested = avgPrice(i) * i.quantity;
      const input = prompt(
        `Por quanto comprou "${i.name}"? (em R$)`,
        suggested ? suggested.toFixed(2) : '',
      );
      if (input === null) return;
      const parsed = Number(input.replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0) purchasedPrice = parsed;
      else if (input.trim() !== '') {
        toast.error('Valor inválido');
        return;
      }
    } else purchasedPrice = null;

    const supabase = createClient();
    const { error } = await supabase
      .from('shopping_list')
      .update({ is_purchased: !i.is_purchased, purchased_price: purchasedPrice })
      .eq('id', i.id);
    if (error) toast.error(error.message);
    else {
      toast.success(i.is_purchased ? 'Voltou pra lista' : `Comprado · ${formatBRL(purchasedPrice ?? 0)}`);
      refresh();
    }
  };

  const remove = async (i: ShoppingItemRow) => {
    if (!confirm(`Excluir "${i.name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('shopping_list').delete().eq('id', i.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Excluído');
      refresh();
    }
  };

  const toggleSelected = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    const next = new Set(selected);
    for (const i of filtered) {
      if (!i.is_purchased && !next.has(i.id)) next.add(i.id);
    }
    setSelected(next);
  };

  const clearSelection = () => setSelected(new Set());

  // ─────────────────────────── Forecast / impacto ───────────────────────────
  const saldoApos = forecast.totalForecast - simulationTotal;
  const saldoSeComprasseTudoAlta = forecast.totalForecast - totals.highSum;
  const saldoSeComprasseTudoMed = forecast.totalForecast - totals.sumAvg;
  const monthsCount = Object.keys(forecast.monthlyBalance).length;
  const avgMonthBalance =
    monthsCount > 0 ? forecast.totalForecast / monthsCount : 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-4 border-b border-rule/60">
        <div>
          <p className="eyebrow">Caderno de</p>
          <h2 className="headline text-4xl font-light tracking-tight">Compras</h2>
          <p className="text-xs italic text-muted-foreground mt-1.5">
            Lista de desejos com referência de preço · também é uma previsão de impacto orçamentário
          </p>
        </div>

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
            Novo item
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? 'Editar item' : 'Novo item'}</SheetTitle>
              <SheetDescription>
                Faixa de preço de referência ajuda a estimar impacto no orçamento.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 px-4 pb-4">
              <ShoppingForm
                key={editing?.id ?? 'new'}
                userId={userId}
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
      </header>

      {/* ═══════════════════════ PAINEL DE IMPACTO ═══════════════════════ */}
      <section>
        <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
          <div>
            <p className="eyebrow mb-1">Editorial</p>
            <h3 className="headline text-2xl font-medium tracking-tight">Impacto no orçamento</h3>
          </div>
          <p className="text-xs italic text-muted-foreground pb-1">
            Baseado em saldo previsto a partir de {formatMonthBR(forecast.startMonth)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule/60 border border-rule/60 rounded-lg overflow-hidden">
          <div className="bg-card px-5 py-4">
            <p className="eyebrow">Saldo previsto</p>
            <p
              className={cn(
                'mt-2 font-mono text-2xl tabular-nums',
                forecast.totalForecast >= 0 ? 'text-money-up' : 'text-money-down',
              )}
            >
              {formatBRL(forecast.totalForecast)}
            </p>
            <p className="text-[11px] text-muted-foreground italic mt-1">
              soma do fluxo previsto até dez/{new Date().getFullYear()} · {monthsCount} meses ·
              média {formatBRL(avgMonthBalance)}/mês
            </p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="eyebrow">Wishlist pendente</p>
            <p className="mt-2 font-mono text-2xl tabular-nums text-foreground">
              {formatBRL(totals.sumAvg)}
            </p>
            <p className="text-[11px] text-muted-foreground italic mt-1 font-mono">
              entre {formatBRL(totals.sumMin)} e {formatBRL(totals.sumMax)} · {totals.count}{' '}
              {totals.count === 1 ? 'item' : 'itens'}
            </p>
          </div>
          <div className="bg-card px-5 py-4">
            <p className="eyebrow">Diferença</p>
            <p
              className={cn(
                'mt-2 font-mono text-2xl tabular-nums',
                forecast.totalForecast - totals.sumAvg >= 0 ? 'text-money-up' : 'text-money-down',
              )}
            >
              {formatBRL(forecast.totalForecast - totals.sumAvg)}
            </p>
            <p className="text-[11px] text-muted-foreground italic mt-1">
              {forecast.totalForecast - totals.sumAvg >= 0
                ? 'sobra mesmo comprando tudo'
                : 'orçamento não fecha — repriorize'}
            </p>
          </div>
        </div>

        {/* Cenários "e se" */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <Scenario
            label="Se comprasse só os de alta prioridade"
            cost={totals.highSum}
            remaining={saldoSeComprasseTudoAlta}
          />
          <Scenario
            label="Se comprasse a wishlist inteira (preço médio)"
            cost={totals.sumAvg}
            remaining={saldoSeComprasseTudoMed}
          />
        </div>
      </section>

      {/* ═══════════════════════ SIMULADOR ═══════════════════════ */}
      <section>
        <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
          <div>
            <p className="eyebrow mb-1">Suplemento</p>
            <h3 className="headline text-2xl font-medium tracking-tight">Simulador</h3>
          </div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={selectAllVisible}
              className="text-muted-foreground hover:text-foreground italic"
            >
              selecionar visíveis
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selected.size === 0}
              className="text-muted-foreground hover:text-foreground italic disabled:opacity-40"
            >
              limpar
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-rule/60 bg-card p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="eyebrow">Selecionados</p>
            <p className="mt-1 font-mono text-xl tabular-nums">
              {selected.size} {selected.size === 1 ? 'item' : 'itens'}
            </p>
            <p className="text-[11px] text-muted-foreground italic mt-0.5">
              clique nos cards abaixo pra incluir
            </p>
          </div>
          <div>
            <p className="eyebrow">Custo estimado</p>
            <p className="mt-1 font-mono text-xl tabular-nums text-money-down">
              {selected.size === 0 ? '—' : formatBRL(simulationTotal)}
            </p>
          </div>
          <div>
            <p className="eyebrow">Saldo após compra</p>
            <p
              className={cn(
                'mt-1 font-mono text-xl tabular-nums',
                saldoApos >= 0 ? 'text-money-up' : 'text-money-down',
              )}
            >
              {selected.size === 0 ? '—' : formatBRL(saldoApos)}
            </p>
            {selected.size > 0 && (
              <p className="text-[11px] text-muted-foreground italic mt-0.5">
                {saldoApos >= 0
                  ? `${((simulationTotal / forecast.totalForecast) * 100).toFixed(0)}% do orçamento`
                  : 'estoura o orçamento previsto'}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════ FILTROS + LISTA ═══════════════════════ */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40">
          <div>
            <p className="eyebrow mb-1">Catálogo</p>
            <h3 className="headline text-2xl font-medium tracking-tight">Itens</h3>
          </div>
          <p className="text-xs italic text-muted-foreground pb-1">
            {filtered.length} {filtered.length === 1 ? 'item' : 'itens'} visível
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="col-span-2 md:col-span-2 relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar item..."
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
          </div>
          <Select
            value={filters.priority}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, priority: (v as Filters['priority']) ?? 'all' }))
            }
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Prioridade: todas</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, status: (v as Filters['status']) ?? 'pending' }))
            }
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="purchased">Comprados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm italic text-muted-foreground py-12">
            Nada por aqui. Adicione um item ou ajuste os filtros.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((i) => (
              <ShoppingCard
                key={i.id}
                item={i}
                isSelected={selected.has(i.id)}
                onToggleSelected={() => toggleSelected(i.id)}
                onEdit={() => setEditing(i)}
                onTogglePurchased={() => togglePurchased(i)}
                onRemove={() => remove(i)}
                disabled={pending}
                impactPercent={
                  forecast.totalForecast > 0 && !i.is_purchased
                    ? (i.quantity * avgPrice(i) / forecast.totalForecast) * 100
                    : null
                }
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Scenario({
  label,
  cost,
  remaining,
}: {
  label: string;
  cost: number;
  remaining: number;
}) {
  return (
    <div className="rounded-md border border-rule/60 bg-card px-4 py-3">
      <p className="text-[11px] text-muted-foreground italic">{label}</p>
      <p className="mt-1 text-xs font-mono">
        custo <span className="text-money-down">{formatBRL(cost)}</span>{' '}
        <span className="text-muted-foreground/60">·</span>{' '}
        sobra{' '}
        <span className={remaining >= 0 ? 'text-money-up' : 'text-money-down'}>
          {formatBRL(remaining)}
        </span>
      </p>
    </div>
  );
}

function ShoppingCard({
  item,
  isSelected,
  onToggleSelected,
  onEdit,
  onTogglePurchased,
  onRemove,
  disabled,
  impactPercent,
}: {
  item: ShoppingItemRow;
  isSelected: boolean;
  onToggleSelected: () => void;
  onEdit: () => void;
  onTogglePurchased: () => void;
  onRemove: () => void;
  disabled: boolean;
  impactPercent: number | null;
}) {
  const min = Number(item.price_min ?? 0);
  const max = Number(item.price_max ?? 0);
  const total = item.quantity * ((min + max) / 2);
  const dotColor = PRIORITY_COLOR[item.priority];

  return (
    <li
      className={cn(
        'rounded-lg border bg-card p-4 transition-all cursor-pointer relative',
        isSelected
          ? 'border-foreground/40 shadow-md ring-1 ring-foreground/20'
          : 'border-rule/60 hover:border-rule',
        item.is_purchased && 'opacity-60 cursor-default',
      )}
      onClick={() => !item.is_purchased && onToggleSelected()}
    >
      {isSelected && (
        <span className="absolute top-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background text-[11px]">
          ✓
        </span>
      )}

      <div className="flex items-start gap-2 mb-1 pr-6">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0 mt-2"
          style={{ background: dotColor }}
          title={`Prioridade: ${PRIORITY_LABEL[item.priority]}`}
        />
        <h3
          className={cn(
            'text-sm font-medium leading-tight truncate flex-1',
            item.is_purchased && 'line-through',
          )}
          title={item.name}
        >
          {item.name}
          {item.quantity > 1 && (
            <span className="ml-1 text-muted-foreground/70">×{item.quantity}</span>
          )}
        </h3>
      </div>

      <p className="text-[11px] italic text-muted-foreground mb-3">
        {item.category ?? '—'}
        {item.store_name && ` · ${item.store_name}`}
        {item.planned_month && ` · ${formatMonthBR(item.planned_month)}`}
      </p>

      {item.is_purchased ? (
        <p className="font-mono text-base text-money-up tabular-nums">
          {formatBRL(item.purchased_price ?? 0)}
          <span className="ml-2 text-[10px] eyebrow text-money-up not-italic">comprado</span>
        </p>
      ) : (min || max) ? (
        <div>
          <p className="font-mono text-sm tabular-nums text-foreground/85">
            {formatBRL(min)} – {formatBRL(max)}
          </p>
          <p className="text-[10px] text-muted-foreground italic font-mono">
            ~ {formatBRL(total)} total
            {impactPercent !== null && impactPercent > 0 && (
              <span className="ml-1.5 not-italic text-foreground/60">
                · {impactPercent.toFixed(impactPercent < 1 ? 2 : 1)}% do orçamento
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground/70">sem faixa de preço</p>
      )}

      {item.notes && (
        <p className="mt-2 text-[11px] text-muted-foreground italic line-clamp-2">{item.notes}</p>
      )}

      <div className="mt-3 pt-3 border-t border-rule/30 flex items-center justify-between gap-1">
        {item.reference_url ? (
          <a
            href={item.reference_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
            ver
          </a>
        ) : (
          <span />
        )}
        <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon-sm"
            variant="ghost"
            title={item.is_purchased ? 'Voltar pra lista' : 'Marcar como comprado'}
            onClick={onTogglePurchased}
            disabled={disabled}
          >
            {item.is_purchased ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Editar"
            onClick={onEdit}
            disabled={disabled}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Excluir"
            onClick={onRemove}
            disabled={disabled}
            className="text-money-down hover:text-money-down"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}
