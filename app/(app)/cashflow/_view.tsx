// app/(app)/cashflow/_view.tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Trash2, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatBRL } from '@/lib/format';
import {
  calculateMonthlyForecastBalance,
  calculateAllocation,
  cashboxMonthlyForecast,
  cashboxRealMonth,
  cashboxBalance,
} from '@/lib/domain/cashboxes';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { CashboxForm } from '@/components/forms/cashbox-form';
import type { CashboxRow, CashboxWithdrawalRow, TransactionRow } from '@/lib/supabase/types';

export function CashflowView({
  userId,
  currentMonthKey,
  cashboxes,
  cashboxTransactions,
  monthTransactions,
  withdrawals,
}: {
  userId: string;
  currentMonthKey: string;
  cashboxes: CashboxRow[];
  cashboxTransactions: TransactionRow[];
  monthTransactions: TransactionRow[];
  withdrawals: CashboxWithdrawalRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CashboxRow | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const forecastBalance = useMemo(
    () => calculateMonthlyForecastBalance(monthTransactions, currentMonthKey),
    [monthTransactions, currentMonthKey],
  );

  const allocation = useMemo(
    () => calculateAllocation(cashboxes, forecastBalance),
    [cashboxes, forecastBalance],
  );

  const enriched = useMemo(() => {
    return cashboxes.map((c) => ({
      cashbox: c,
      forecast: cashboxMonthlyForecast(c),
      real: cashboxRealMonth(c.id, currentMonthKey, cashboxTransactions, withdrawals),
      balance: cashboxBalance(c.id, cashboxTransactions, withdrawals),
    }));
  }, [cashboxes, currentMonthKey, cashboxTransactions, withdrawals]);

  const remove = async (c: CashboxRow) => {
    if (
      !confirm(
        `Excluir "${c.name}"? As entradas já lançadas ficam no banco mas perdem o vínculo com este caixa.`,
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from('cashboxes').delete().eq('id', c.id);
    if (error) toast.error(error.message);
    else {
      toast.success('Caixa excluído');
      refresh();
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-4 border-b border-rule/60">
        <div>
          <p className="eyebrow">Caderno de</p>
          <h2 className="headline text-4xl font-light tracking-tight">Fluxo de caixa</h2>
          <p className="text-xs italic text-muted-foreground mt-1.5">
            {cashboxes.length} {cashboxes.length === 1 ? 'caixa cadastrado' : 'caixas cadastrados'}
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
            Novo caixa
          </SheetTrigger>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{editing ? 'Editar caixa' : 'Novo caixa'}</SheetTitle>
              <SheetDescription>
                Meta mensal e meta total são opcionais.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 px-4 pb-4">
              <CashboxForm
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

      <section className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule/60 border border-rule/60 rounded-lg overflow-hidden">
        <div className="bg-card px-4 py-4">
          <p className="eyebrow truncate">Saldo previsto do mês</p>
          <p className="mt-2 font-mono text-lg md:text-xl tabular-nums text-foreground">
            {formatBRL(forecastBalance)}
          </p>
        </div>
        <div className="bg-card px-4 py-4">
          <p className="eyebrow truncate">Alocado em metas</p>
          <p className="mt-2 font-mono text-lg md:text-xl tabular-nums text-foreground">
            {formatBRL(allocation.allocated)}
          </p>
        </div>
        <div className="bg-card px-4 py-4">
          <p className="eyebrow truncate">Não alocado</p>
          <p
            className={`mt-2 font-mono text-lg md:text-xl tabular-nums ${
              allocation.unallocated >= 0 ? 'text-money-up' : 'text-money-down'
            }`}
          >
            {formatBRL(allocation.unallocated)}
          </p>
        </div>
      </section>

      {cashboxes.length === 0 ? (
        <div className="text-center py-16">
          <PiggyBank className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" strokeWidth={1.5} />
          <p className="text-sm italic text-muted-foreground">
            Nenhum caixa ainda. Crie um pra começar a acompanhar suas metas.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {enriched.map(({ cashbox, forecast, real, balance }) => {
            const progress = forecast > 0 ? Math.min(100, (real / forecast) * 100) : 0;
            const totalGoal = Number(cashbox.total_goal ?? 0);
            const totalProgress = totalGoal > 0 ? Math.min(100, (balance / totalGoal) * 100) : 0;
            return (
              <li key={cashbox.id}>
                <div className="rounded-lg border border-rule/60 bg-card overflow-hidden px-5 py-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl tracking-tight">{cashbox.name}</h3>
                      <p className="text-[11px] italic text-muted-foreground mt-1">
                        Saldo acumulado
                      </p>
                      <p
                        className={`font-mono text-2xl tabular-nums ${
                          balance >= 0 ? 'text-money-up' : 'text-money-down'
                        }`}
                      >
                        {formatBRL(balance)}
                      </p>
                    </div>
                    <div className="flex gap-0.5">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Editar"
                        onClick={() => setEditing(cashbox)}
                        disabled={pending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="Excluir"
                        onClick={() => remove(cashbox)}
                        disabled={pending}
                        className="text-money-down hover:text-money-down"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {forecast > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Este mês</span>
                        <span className="font-mono tabular-nums">
                          {formatBRL(real)} / {formatBRL(forecast)}
                        </span>
                      </div>
                      <Progress value={progress} />
                    </div>
                  )}

                  {totalGoal > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Meta total</span>
                        <span className="font-mono tabular-nums">
                          {formatBRL(balance)} / {formatBRL(totalGoal)}
                        </span>
                      </div>
                      <Progress value={totalProgress} />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
