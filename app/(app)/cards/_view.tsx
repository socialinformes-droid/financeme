'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  formatBRL,
  formatMonthBR,
  toISODate,
  firstDayOfMonth,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { CardForm } from '@/components/forms/card-form';
import { FaturaGrid } from '@/components/cards/fatura-grid';
import type { CardRow, TransactionRow } from '@/lib/supabase/types';

export function CardsView({
  userId,
  initialCards,
  transactions,
}: {
  userId: string;
  initialCards: CardRow[];
  transactions: TransactionRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CardRow | null>(null);

  const todayKey = toISODate(firstDayOfMonth(new Date()));

  const enriched = useMemo(() => {
    return initialCards.map((c) => {
      const cardTxs = transactions.filter((t) => t.card_id === c.id);
      const currentFatura = cardTxs
        .filter((t) => t.billing_month === todayKey)
        .reduce((a, t) => a + Math.abs(Number(t.amount)), 0);
      // últimas 6 faturas
      const byMonth = new Map<string, number>();
      for (const t of cardTxs) {
        if (!t.billing_month) continue;
        byMonth.set(t.billing_month, (byMonth.get(t.billing_month) ?? 0) + Math.abs(Number(t.amount)));
      }
      const history = [...byMonth.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6)
        .reverse();
      return { card: c, currentFatura, history, txCount: cardTxs.length };
    });
  }, [initialCards, transactions, todayKey]);

  const refresh = () => startTransition(() => router.refresh());

  const remove = async (c: CardRow) => {
    if (!confirm(`Excluir "${c.name}"? As transações ficam no banco mas perdem a referência.`))
      return;
    const supabase = createClient();
    const { error } = await supabase.from('cards').delete().eq('id', c.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Cartão excluído');
      refresh();
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-4 border-b border-rule/60">
        <div>
          <p className="eyebrow">Caderno de</p>
          <h2 className="headline text-4xl font-light tracking-tight">Cartões</h2>
          <p className="text-xs italic text-muted-foreground mt-1.5">
            {initialCards.length}{' '}
            {initialCards.length === 1 ? 'cartão cadastrado' : 'cartões cadastrados'}
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
            Novo cartão
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? 'Editar cartão' : 'Novo cartão'}</SheetTitle>
              <SheetDescription>
                Dia de fechamento define em qual fatura cada compra cai.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 px-4 pb-4">
              <CardForm
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

      {initialCards.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm italic text-muted-foreground mb-4">
            Nenhum cartão ainda. Adicione pra calcular o mês da fatura automaticamente nas compras no crédito.
          </p>
        </div>
      ) : (
        <>
        <FaturaGrid
          userId={userId}
          cards={initialCards}
          transactions={transactions}
          year={new Date().getFullYear()}
        />

        <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 pt-4">
          <div>
            <p className="eyebrow mb-1">Detalhe</p>
            <h3 className="headline text-2xl font-medium tracking-tight">Por cartão</h3>
          </div>
          <p className="text-xs italic text-muted-foreground pb-1">
            Visão individual com fatura atual e histórico
          </p>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enriched.map(({ card, currentFatura, history, txCount }) => {
            const limit = Number(card.limit_amount ?? 0);
            const usage = limit > 0 ? (currentFatura / limit) * 100 : 0;
            return (
              <li key={card.id}>
                <div
                  className="rounded-lg border border-rule/60 bg-card overflow-hidden"
                  style={{ borderTopWidth: '4px', borderTopColor: card.color ?? '#737373' }}
                >
                  <div className="px-5 pt-5 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p
                          className="eyebrow mb-0.5"
                          style={{ color: card.color ?? undefined }}
                        >
                          {card.brand ?? '—'}
                        </p>
                        <h3 className="font-display text-2xl tracking-tight">{card.name}</h3>
                        <p className="text-[11px] italic text-muted-foreground mt-1">
                          fechamento dia {card.closing_day} · vencimento dia {card.due_day} ·{' '}
                          {txCount} {txCount === 1 ? 'compra' : 'compras'}
                        </p>
                      </div>
                      <div className="flex gap-0.5">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Editar"
                          onClick={() => setEditing(card)}
                          disabled={pending}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title="Excluir"
                          onClick={() => remove(card)}
                          disabled={pending}
                          className="text-money-down hover:text-money-down"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="eyebrow">Fatura {formatMonthBR(todayKey)}</p>
                        <p className="font-mono text-2xl tabular-nums text-money-down">
                          {formatBRL(currentFatura)}
                        </p>
                      </div>
                      {limit > 0 && (
                        <div className="text-right">
                          <p className="eyebrow">Limite</p>
                          <p className="font-mono text-sm tabular-nums text-foreground/70">
                            {formatBRL(limit)}
                          </p>
                        </div>
                      )}
                    </div>

                    {limit > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="h-1 rounded-full bg-paper-dark/60 overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all',
                              usage > 80
                                ? 'bg-money-down'
                                : usage > 50
                                  ? 'bg-accent-warm'
                                  : 'bg-money-up',
                            )}
                            style={{ width: `${Math.min(100, usage)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          {usage.toFixed(0)}% do limite
                        </p>
                      </div>
                    )}
                  </div>

                  {history.length > 0 && (
                    <div className="border-t border-rule/40 px-5 py-3 bg-paper-dark/20">
                      <p className="eyebrow mb-2">Histórico</p>
                      <ul className="grid grid-cols-6 gap-2">
                        {history.map(([month, total]) => {
                          const isCurrent = month === todayKey;
                          return (
                            <li key={month} className="text-center">
                              <p
                                className={cn(
                                  'text-[10px] uppercase tracking-wider',
                                  isCurrent
                                    ? 'text-foreground font-medium'
                                    : 'text-muted-foreground',
                                )}
                              >
                                {formatMonthBR(month)}
                              </p>
                              <p
                                className={cn(
                                  'font-mono text-xs tabular-nums',
                                  isCurrent ? 'text-money-down' : 'text-foreground/70',
                                )}
                              >
                                {(total / 1000).toFixed(1)}k
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </div>
  );
}
