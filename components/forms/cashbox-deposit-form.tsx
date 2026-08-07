'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { toISODate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Database } from '@/lib/supabase/types';

export type CashboxDepositFormProps = {
  userId: string;
  cashboxId: string;
  onDone?: () => void;
};

export function CashboxDepositForm({
  userId,
  cashboxId,
  onDone,
}: CashboxDepositFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState(0);
  const [depositDate, setDepositDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      type Insert = Database['public']['Tables']['cashbox_deposits']['Insert'];
      const payload: Insert = {
        user_id: userId,
        cashbox_id: cashboxId,
        amount,
        deposit_date: depositDate,
        note: note.trim() || null,
      };
      const { error } = await supabase.from('cashbox_deposits').insert(payload);
      if (error) throw error;
      toast.success('Entrada registrada');
      setAmount(0);
      setNote('');
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Valor (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input
            type="date"
            value={depositDate}
            onChange={(e) => setDepositDate(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="deposit-note">Nota (opcional)</Label>
        <Textarea
          id="deposit-note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Salvando...' : 'Registrar entrada'}
      </Button>
    </form>
  );
}
