'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  formatBRL,
  formatMonthBR,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { InstallmentGroupForm } from '@/components/forms/installment-group-form';
import { TransactionForm } from '@/components/forms/transaction-form';
import type { TransactionRow, CardRow, CategoryRow } from '@/lib/supabase/types';

export type Group = {
  groupId: string;
  description: string;
  category: string;
  payment_method: string;
  total: number;
  paidAmount: number;
  totalParts: number;
  paidParts: number;
  startMonth: string;
  endMonth: string;
  rows: TransactionRow[];
  status: 'active' | 'finished' | 'upcoming';
  kind: 'installment' | 'recurring';
};

export function InstallmentsView({
  userId,
  groups,
  cards,
  categories,
  year,
  todayKey,
}: {
  userId: string;
  groups: Group[];
  cards: CardRow[];
  categories: CategoryRow[];
  year: number;
  todayKey: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<TransactionRow | null>(null);
  const [groupContextRowId, setGroupContextRowId] = useState<string | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const selectedGroup = useMemo(
    () => groups.find((g) => g.groupId === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  );

  const totalActive = groups
    .filter((g) => g.status !== 'finished')
    .reduce((a, g) => a + (g.total - g.paidAmount), 0);

  const endingByMonth = new Map<string, Group[]>();
  for (const g of groups) {
    if (g.status === 'finished') continue;
    const arr = endingByMonth.get(g.endMonth) ?? [];
    arr.push(g);
    endingByMonth.set(g.endMonth, arr);
  }
  const sortedEndingMonths = [...endingByMonth.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-4 border-b border-rule/60">
        <div>
          <p className="eyebrow">Caderno de</p>
          <h2 className="headline text-4xl font-light tracking-tight">Parcelas e recorrentes</h2>
          <p className="text-xs italic text-muted-foreground mt-1.5">
            <span className="font-mono not-italic mr-1">{year}</span> · {groups.length}{' '}
            {groups.length === 1 ? 'grupo ativo' : 'grupos ativos'} · em aberto{' '}
            <span className="font-mono not-italic text-money-down">{formatBRL(totalActive)}</span>
          </p>
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="text-center text-sm italic text-muted-foreground py-12">
          Nenhuma parcela em aberto.
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <p className="eyebrow">Em andamento</p>
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groups
                .filter((g) => g.status !== 'finished')
                .map((g) => (
                  <InstallmentGroupCard
                    key={g.groupId}
                    group={g}
                    todayKey={todayKey}
                    onOpenGroup={() => setSelectedGroupId(g.groupId)}
                    onOpenParcela={(t) => setEditingTx(t)}
                  />
                ))}
            </ul>
          </section>

          {sortedEndingMonths.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
                <div>
                  <p className="eyebrow mb-1">Calendário</p>
                  <h3 className="headline text-2xl font-medium tracking-tight">Encerramentos</h3>
                </div>
                <p className="text-xs italic text-muted-foreground pb-1">
                  Quando cada grupo termina
                </p>
              </div>
              <ul className="divide-y divide-rule/40 border border-rule/60 rounded-md bg-card">
                {sortedEndingMonths.map(([month, gs]) => (
                  <li key={month} className="flex items-center gap-4 px-5 py-3">
                    <span className="font-display italic text-base w-20 shrink-0">
                      {formatMonthBR(month)}
                    </span>
                    <ul className="flex-1 flex flex-wrap gap-2">
                      {gs.map((g) => (
                        <li key={g.groupId}>
                          <button
                            type="button"
                            onClick={() => setSelectedGroupId(g.groupId)}
                            className="text-xs px-2.5 py-1 rounded-full bg-paper-dark/50 border border-rule/50 hover:bg-paper-dark/80 hover:border-rule transition-colors"
                          >
                            {g.description}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <span className="text-xs text-muted-foreground italic">
                      {gs.length} {gs.length === 1 ? 'grupo' : 'grupos'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {groups.some((g) => g.status === 'finished') && (
            <section className="space-y-3">
              <p className="eyebrow">Encerradas</p>
              <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {groups
                  .filter((g) => g.status === 'finished')
                  .map((g) => (
                    <InstallmentGroupCard
                      key={g.groupId}
                      group={g}
                      todayKey={todayKey}
                      onOpenGroup={() => setSelectedGroupId(g.groupId)}
                      onOpenParcela={(t) => setEditingTx(t)}
                    />
                  ))}
              </ul>
            </section>
          )}
        </>
      )}

      {/* Sheet: editar grupo */}
      <Sheet
        open={!!selectedGroup}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedGroupId(null);
            setGroupContextRowId(null);
          }
        }}
      >
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedGroup && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedGroup.description}</SheetTitle>
                <SheetDescription>
                  Editar grupo de {selectedGroup.totalParts}{' '}
                  {selectedGroup.kind === 'recurring' ? 'meses' : 'parcelas'}. Por padrão as ações
                  não tocam em linhas pagas — use o switch quando precisar incluir.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 px-4 pb-4 space-y-6">
                <InstallmentGroupForm
                  rows={selectedGroup.rows}
                  cards={cards}
                  categories={categories}
                  contextRowId={groupContextRowId ?? undefined}
                  onDone={() => {
                    setSelectedGroupId(null);
                    setGroupContextRowId(null);
                    refresh();
                  }}
                />

                <ParcelaList
                  rows={selectedGroup.rows}
                  todayKey={todayKey}
                  kind={selectedGroup.kind}
                  onEdit={(t) => setEditingTx(t)}
                  onChange={refresh}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Sheet: editar parcela individual */}
      <Sheet
        open={!!editingTx}
        onOpenChange={(o) => {
          if (!o) setEditingTx(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar parcela</SheetTitle>
            <SheetDescription>
              Mudanças aplicam só nessa linha — as outras parcelas do grupo não são afetadas.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 px-4 pb-4">
            {editingTx && (
              <TransactionForm
                key={editingTx.id}
                userId={userId}
                cards={cards}
                categories={categories}
                editing={editingTx}
                onDone={() => {
                  setEditingTx(null);
                  refresh();
                }}
                onEditGroup={
                  editingTx.installment_group_id
                    ? () => {
                        const groupId = editingTx.installment_group_id;
                        setGroupContextRowId(editingTx.id);
                        setSelectedGroupId(groupId);
                        setEditingTx(null);
                      }
                    : undefined
                }
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function InstallmentGroupCard({
  group,
  todayKey,
  onOpenGroup,
  onOpenParcela,
}: {
  group: Group;
  todayKey: string;
  onOpenGroup: () => void;
  onOpenParcela: (t: TransactionRow) => void;
}) {
  const remaining = group.total - group.paidAmount;
  const progress = (group.paidParts / group.totalParts) * 100;
  const isFinished = group.status === 'finished';
  const isRecurring = group.kind === 'recurring';

  return (
    <Card
      className={cn(
        'rounded-lg border-rule/60 shadow-none transition-all',
        isFinished && 'opacity-70',
      )}
    >
      <CardContent className="pt-5">
        <button
          type="button"
          onClick={onOpenGroup}
          className="text-left w-full group/header"
          aria-label={`Editar grupo ${group.description}`}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="eyebrow">{group.category}</p>
                {isRecurring && (
                  <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent-foreground/70 not-italic">
                    Recorrente
                  </span>
                )}
              </div>
              <h4 className="font-medium text-base group-hover/header:underline decoration-dotted underline-offset-4">
                {group.description}
              </h4>
              <p className="text-[11px] italic text-muted-foreground capitalize">
                {group.payment_method} · {formatMonthBR(group.startMonth)} →{' '}
                {formatMonthBR(group.endMonth)}
              </p>
            </div>
            <div className="text-right">
              <p className="eyebrow">Total</p>
              <p className="font-mono text-base tabular-nums">{formatBRL(group.total)}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="h-1 rounded-full bg-paper-dark/60 overflow-hidden">
              <div
                className="h-full bg-money-down/80 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>
                {group.paidParts}/{group.totalParts} pagas
              </span>
              {!isFinished && (
                <span className="font-mono tabular-nums text-money-down/80">
                  resta {formatBRL(remaining)}
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="mt-4 pt-3 border-t border-rule/30">
          <p className="eyebrow mb-2">Linha do tempo</p>
          <ol className="grid grid-cols-12 gap-px">
            {group.rows.map((t) => {
              const isCurrent = t.billing_month === todayKey;
              const isPast = (t.billing_month ?? '') < todayKey;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenParcela(t);
                    }}
                    title={`${formatMonthBR(t.billing_month)} · ${formatBRL(t.amount)} · ${
                      t.is_paid ? 'pago' : 'pendente'
                    } · clique pra editar`}
                    className={cn(
                      'h-5 w-full rounded-sm transition-all hover:ring-2 hover:ring-foreground/30 hover:scale-110 cursor-pointer',
                      t.is_paid
                        ? 'bg-money-up/60'
                        : isPast
                          ? 'bg-money-down/60'
                          : isCurrent
                            ? 'bg-accent ring-1 ring-foreground/30'
                            : 'bg-rule/40',
                    )}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function ParcelaList({
  rows,
  todayKey,
  kind,
  onEdit,
  onChange,
}: {
  rows: TransactionRow[];
  todayKey: string;
  kind: 'installment' | 'recurring';
  onEdit: (t: TransactionRow) => void;
  onChange: () => void;
}) {
  const isRecurring = kind === 'recurring';
  const togglePaid = async (t: TransactionRow) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('transactions')
      .update({ is_paid: !t.is_paid })
      .eq('id', t.id);
    if (error) toast.error(error.message);
    else {
      toast.success(t.is_paid ? 'Marcada como pendente' : 'Marcada como paga');
      onChange();
    }
  };

  const removeOne = async (t: TransactionRow) => {
    const label = isRecurring
      ? `Excluir a ocorrência de ${t.billing_month?.slice(0, 7) ?? ''}?`
      : `Excluir a parcela ${t.installment_number}/${t.total_installments}?`;
    if (!confirm(label)) return;
    const supabase = createClient();
    const { error } = await supabase.from('transactions').delete().eq('id', t.id);
    if (error) toast.error(error.message);
    else {
      toast.success(isRecurring ? 'Ocorrência excluída' : 'Parcela excluída');
      onChange();
    }
  };

  return (
    <section className="space-y-2">
      <p className="eyebrow">{isRecurring ? 'Ocorrências mensais' : 'Parcelas individuais'}</p>
      <ul className="divide-y divide-rule/40 border border-rule/60 rounded-md bg-card">
        {rows.map((t, idx) => {
          const isCurrent = t.billing_month === todayKey;
          const isPast = (t.billing_month ?? '') < todayKey && !t.is_paid;
          const numberLabel = isRecurring
            ? `${idx + 1}/${rows.length}`
            : `${t.installment_number}/${t.total_installments}`;
          return (
            <li
              key={t.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 text-sm',
                isCurrent && 'bg-accent/10',
              )}
            >
              <span className="font-mono text-xs text-muted-foreground w-12 shrink-0 tabular-nums">
                {numberLabel}
              </span>
              <span className="font-display italic w-20 shrink-0">
                {formatMonthBR(t.billing_month)}
              </span>
              <span className="font-mono tabular-nums flex-1">{formatBRL(t.amount)}</span>
              <span
                className={cn(
                  'text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded',
                  t.is_paid
                    ? 'bg-money-up/15 text-money-up'
                    : isPast
                      ? 'bg-money-down/15 text-money-down'
                      : 'bg-paper-dark/50 text-muted-foreground',
                )}
              >
                {t.is_paid ? 'pago' : isPast ? 'atrasado' : 'pendente'}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => togglePaid(t)}
                title={t.is_paid ? 'Marcar como pendente' : 'Marcar como paga'}
                className="h-7 w-7"
              >
                <CheckCircle2
                  className={cn('h-3.5 w-3.5', t.is_paid && 'text-money-up')}
                />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => onEdit(t)}
                title="Editar"
                className="h-7 w-7"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => removeOne(t)}
                title="Excluir"
                className="h-7 w-7 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
