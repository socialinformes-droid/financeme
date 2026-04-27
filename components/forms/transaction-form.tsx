'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_CATEGORIES } from '@/lib/domain/categories';
import { calculateBillingMonth } from '@/lib/domain/billing';
import { createInstallmentTransactions } from '@/lib/domain/installments';
import { firstDayOfMonth, formatBRL, toISODate } from '@/lib/format';
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
import type { CardRow, TransactionRow } from '@/lib/supabase/types';

const schema = z.object({
  description: z.string().min(1, 'Obrigatório'),
  amount: z.number().positive('Deve ser > 0'),
  type: z.enum(['income', 'expense']),
  payment_method: z.enum(['credit', 'debit', 'pix', 'cash']),
  category: z.string().min(1),
  transaction_date: z.string().min(1),
  card_id: z.string().optional(),
  notes: z.string().optional(),
  is_recurring: z.boolean(),
  is_paid: z.boolean(),
  is_installment: z.boolean(),
  total_installments: z.number().int().min(1).max(60).optional(),
});

type FormValues = z.infer<typeof schema>;

export type TransactionFormProps = {
  userId: string;
  cards: CardRow[];
  /** Categorias do user (do DB). Se vazio/omitido, usa DEFAULT_CATEGORIES. */
  categories?: ReadonlyArray<{ name: string }>;
  onDone?: () => void;
  /** Quando passado, o formulário vira modo edit e faz UPDATE em vez de INSERT. */
  editing?: TransactionRow | null;
};

export function TransactionForm({ userId, cards, categories, onDone, editing }: TransactionFormProps) {
  const categoryList = categories?.length
    ? categories.map((c) => c.name)
    : DEFAULT_CATEGORIES.map((c) => c.name);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!editing;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          description: editing.description,
          amount: Math.abs(Number(editing.amount)),
          type: editing.type,
          payment_method: editing.payment_method,
          category: editing.category,
          transaction_date: editing.transaction_date,
          card_id: editing.card_id ?? undefined,
          notes: editing.notes ?? '',
          is_recurring: editing.is_recurring,
          is_paid: editing.is_paid,
          is_installment: false, // não é editável em modo edit
        }
      : {
          description: '',
          amount: 0,
          type: 'expense',
          payment_method: 'debit',
          category: 'Outros',
          transaction_date: toISODate(new Date()),
          is_recurring: false,
          is_paid: false,
          is_installment: false,
        },
  });

  const type = form.watch('type');
  const paymentMethod = form.watch('payment_method');
  const isInstallment = form.watch('is_installment');
  const totalInstallments = form.watch('total_installments') ?? 0;
  const amount = form.watch('amount');

  useEffect(() => {
    if (type === 'income') form.setValue('is_installment', false);
  }, [type, form]);

  const onSubmit = async (values: FormValues) => {
    // Cross-field validation que o schema não cobre
    if (values.payment_method === 'credit' && !values.card_id) {
      form.setError('card_id', { message: 'Selecione um cartão para crédito' });
      return;
    }
    if (values.is_installment && (values.total_installments ?? 0) < 2) {
      form.setError('total_installments', { message: '>= 2 parcelas' });
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const txDate = new Date(`${values.transaction_date}T12:00:00`);
      const card = cards.find((c) => c.id === values.card_id) ?? null;
      const expenseMonth = toISODate(firstDayOfMonth(txDate));

      const sign = values.type === 'income' ? 1 : -1;
      const total = Math.abs(values.amount) * sign;

      // ── Modo EDIT: UPDATE direto, sem mexer em parcelas/group ─────────────
      if (isEdit && editing) {
        const billingMonth = calculateBillingMonth(txDate, values.payment_method, card);
        const { error } = await supabase
          .from('transactions')
          .update({
            description: values.description,
            amount: total,
            type: values.type,
            payment_method: values.payment_method,
            category: values.category,
            notes: values.notes ?? null,
            expense_month: expenseMonth,
            billing_month: billingMonth,
            card_id: values.card_id ?? null,
            is_recurring: values.is_recurring,
            is_paid: values.is_paid,
            transaction_date: values.transaction_date,
          })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Lançamento atualizado');
        onDone?.();
        return;
      }

      if (values.is_installment && values.type === 'expense' && (values.total_installments ?? 0) > 1) {
        const rows = createInstallmentTransactions({
          user_id: userId,
          description: values.description,
          totalAmount: Math.abs(values.amount),
          installments: values.total_installments!,
          startDate: txDate,
          category: values.category,
          paymentMethod: values.payment_method,
          cardId: values.card_id ?? null,
          card,
          notes: values.notes ?? null,
          isRecurring: values.is_recurring,
        });
        const { error } = await supabase.from('transactions').insert(rows);
        if (error) throw error;
        toast.success(`${rows.length} parcelas criadas`);
      } else {
        const billingMonth = calculateBillingMonth(txDate, values.payment_method, card);
        const { error } = await supabase.from('transactions').insert({
          user_id: userId,
          description: values.description,
          amount: total,
          type: values.type,
          payment_method: values.payment_method,
          category: values.category,
          notes: values.notes ?? null,
          expense_month: expenseMonth,
          billing_month: billingMonth,
          card_id: values.card_id ?? null,
          is_recurring: values.is_recurring,
          is_paid: values.is_paid,
          transaction_date: values.transaction_date,
          is_installment: false,
          installment_number: null,
          total_installments: null,
          installment_group_id: null,
          installment_end_date: null,
        });
        if (error) throw error;
        toast.success('Lançamento criado');
      }
      form.reset({
        ...form.getValues(),
        description: '',
        amount: 0,
        notes: '',
      });
      onDone?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Controller
            name="type"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v ?? 'expense')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Saída</SelectItem>
                  <SelectItem value="income">Entrada</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Método</Label>
          <Controller
            name="payment_method"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v ?? 'debit')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" {...form.register('description')} />
        {form.formState.errors.description && (
          <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="amount">Valor (R$)</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            {...form.register('amount', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="transaction_date">Data</Label>
          <Input id="transaction_date" type="date" {...form.register('transaction_date')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Controller
            name="category"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v ?? 'Outros')}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categoryList.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        {paymentMethod === 'credit' && (
          <div className="space-y-1.5">
            <Label>Cartão</Label>
            <Controller
              name="card_id"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  onValueChange={(v) => field.onChange(v ?? undefined)}
                >
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
              )}
            />
            {form.formState.errors.card_id && (
              <p className="text-xs text-destructive">{form.formState.errors.card_id.message}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" rows={2} {...form.register('notes')} />
      </div>

      <div className="space-y-3 rounded-md border border-border/60 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Recorrente</p>
            <p className="text-xs text-muted-foreground">Repete todo mês</p>
          </div>
          <Controller
            name="is_recurring"
            control={form.control}
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Pago</p>
            <p className="text-xs text-muted-foreground">Marcar como já quitado</p>
          </div>
          <Controller
            name="is_paid"
            control={form.control}
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>

        {type === 'expense' && !isEdit && (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Parcelado</p>
              <p className="text-xs text-muted-foreground">Gera N transações automáticas</p>
            </div>
            <Controller
              name="is_installment"
              control={form.control}
              render={({ field }) => (
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
        )}

        {isEdit && editing?.is_installment && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-foreground/80">
            Esta é a parcela {editing.installment_number}/{editing.total_installments}.
            A edição afeta só esta linha — outras parcelas do grupo permanecem inalteradas.
          </div>
        )}

        {isInstallment && !isEdit && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Total de parcelas</Label>
              <Input
                type="number"
                min={2}
                max={60}
                {...form.register('total_installments', { valueAsNumber: true })}
              />
              {form.formState.errors.total_installments && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.total_installments.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Por parcela</Label>
              <p className="font-mono text-sm pt-2">
                {totalInstallments > 0 && amount > 0
                  ? formatBRL(amount / totalInstallments)
                  : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Salvando...' : isEdit ? 'Atualizar' : 'Salvar'}
      </Button>
    </form>
  );
}
