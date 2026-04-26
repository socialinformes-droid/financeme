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
  Sparkles,
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

const ALL = '__all';
const PRIORITY_COLOR: Record<'high' | 'medium' | 'low', string> = {
  high: 'oklch(0.48 0.18 30)', // terracota
  medium: 'oklch(0.55 0.13 70)', // ocre
  low: 'oklch(0.55 0.04 60)', // taupe claro
};

export function ShoppingView({
  userId,
  initial,
}: {
  userId: string;
  initial: ShoppingItemRow[];
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

  const totals = useMemo(() => {
    let min = 0;
    let max = 0;
    let highSubtotal = 0;
    for (const i of filtered) {
      if (i.is_purchased) continue;
      const lo = Number(i.price_min ?? 0) * i.quantity;
      const hi = Number(i.price_max ?? 0) * i.quantity;
      min += lo;
      max += hi;
      if (i.priority === 'high') highSubtotal += (lo + hi) / 2;
    }
    const avg = (min + max) / 2;
    return { min, max, avg, highSubtotal, count: filtered.filter((i) => !i.is_purchased).length };
  }, [filtered]);

  const refresh = () => startTransition(() => router.refresh());

  const togglePurchased = async (i: ShoppingItemRow) => {
    let purchasedPrice: number | null = i.purchased_price ?? null;
    if (!i.is_purchased) {
      const suggested = i.price_min && i.price_max
        ? (Number(i.price_min) + Number(i.price_max)) / 2
        : Number(i.price_max ?? i.price_min ?? 0);
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
    } else {
      purchasedPrice = null;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('shopping_list')
      .update({
        is_purchased: !i.is_purchased,
        purchased_price: purchasedPrice,
      })
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-4 border-b border-rule/60">
        <div>
          <p className="eyebrow">Caderno de</p>
          <h2 className="headline text-4xl font-light tracking-tight">Compras</h2>
          <p className="text-xs italic text-muted-foreground mt-1.5">
            {totals.count} {totals.count === 1 ? 'item pendente' : 'itens pendentes'} · estimado entre{' '}
            <span className="font-mono not-italic">{formatBRL(totals.min)}</span> e{' '}
            <span className="font-mono not-italic">{formatBRL(totals.max)}</span> · prioridade alta{' '}
            <span className="font-mono not-italic text-money-down">{formatBRL(totals.highSubtotal)}</span>
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
                Registre um item da lista de desejos com faixa de preço de referência.
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

      {/* Filtros */}
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
        {categories.length > 0 && (
          <Select
            value={filters.category}
            onValueChange={(v) => setFilters((f) => ({ ...f, category: v ?? ALL }))}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Categoria: todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Grid */}
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
              onEdit={() => setEditing(i)}
              onTogglePurchased={() => togglePurchased(i)}
              onRemove={() => remove(i)}
              disabled={pending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ShoppingCard({
  item,
  onEdit,
  onTogglePurchased,
  onRemove,
  disabled,
}: {
  item: ShoppingItemRow;
  onEdit: () => void;
  onTogglePurchased: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  const min = Number(item.price_min ?? 0);
  const max = Number(item.price_max ?? 0);
  const total = item.quantity * ((min + max) / 2);
  const dotColor = PRIORITY_COLOR[item.priority];

  return (
    <li
      className={cn(
        'rounded-lg border border-rule/60 bg-card p-4 transition-all',
        'hover:border-rule hover:shadow-sm',
        item.is_purchased && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
            style={{ background: dotColor }}
            title={`Prioridade: ${item.priority}`}
          />
          <h3
            className={cn(
              'text-sm font-medium leading-tight truncate',
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
        <div className="flex gap-0.5">
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
