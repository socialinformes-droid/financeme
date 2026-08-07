'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CashboxRow, Database } from '@/lib/supabase/types';

export type CashboxFormProps = {
  userId: string;
  editing?: CashboxRow | null;
  onDone?: () => void;
};

export function CashboxForm({ userId, editing, onDone }: CashboxFormProps) {
  const isEdit = !!editing;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(editing?.name ?? '');
  const [monthlyGoal, setMonthlyGoal] = useState(Number(editing?.monthly_goal ?? 0));
  const [totalGoal, setTotalGoal] = useState(Number(editing?.total_goal ?? 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Adicione um nome');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      type Insert = Database['public']['Tables']['cashboxes']['Insert'];
      const payload: Insert = {
        user_id: userId,
        name: name.trim(),
        monthly_goal: monthlyGoal || null,
        total_goal: totalGoal || null,
      };
      if (isEdit && editing) {
        const { error } = await supabase.from('cashboxes').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Caixa atualizado');
      } else {
        const { error } = await supabase.from('cashboxes').insert(payload);
        if (error) throw error;
        toast.success('Caixa criado');
      }
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
      <div className="space-y-1.5">
        <Label htmlFor="cashbox-name">Nome</Label>
        <Input
          id="cashbox-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fundo Emergência, Viagem 2026..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Meta mensal (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={monthlyGoal || ''}
            onChange={(e) => setMonthlyGoal(Number(e.target.value) || 0)}
            placeholder="0,00 (opcional)"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Meta total (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={totalGoal || ''}
            onChange={(e) => setTotalGoal(Number(e.target.value) || 0)}
            placeholder="0,00 (opcional)"
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar caixa'}
      </Button>
    </form>
  );
}
