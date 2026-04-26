'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
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
import type { CardRow, Database } from '@/lib/supabase/types';

const BRANDS = ['Visa', 'Mastercard', 'Amex', 'Elo', 'Hipercard', 'Outro'];
const PRESET_COLORS = [
  '#6b4f7a', // plum
  '#3f7a7a', // teal
  '#4e6e8e', // azul-aço
  '#a85e7a', // rose-velho
  '#a8862e', // mostarda
  '#5a7d4f', // forest
  '#5a5e68', // grafite
  '#a84e3e', // rust
];

export type CardFormProps = {
  userId: string;
  editing?: CardRow | null;
  onDone?: () => void;
};

export function CardForm({ userId, editing, onDone }: CardFormProps) {
  const isEdit = !!editing;
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(editing?.name ?? '');
  const [brand, setBrand] = useState(editing?.brand ?? 'Visa');
  const [limitAmount, setLimitAmount] = useState(Number(editing?.limit_amount ?? 0));
  const [closingDay, setClosingDay] = useState(editing?.closing_day ?? 20);
  const [dueDay, setDueDay] = useState(editing?.due_day ?? 27);
  const [color, setColor] = useState(editing?.color ?? PRESET_COLORS[0]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Adicione um nome');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      type Insert = Database['public']['Tables']['cards']['Insert'];
      const payload: Insert = {
        user_id: userId,
        name: name.trim(),
        brand,
        limit_amount: limitAmount || null,
        closing_day: closingDay,
        due_day: dueDay,
        color,
      };
      if (isEdit && editing) {
        const { error } = await supabase.from('cards').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Cartão atualizado');
      } else {
        const { error } = await supabase.from('cards').insert(payload);
        if (error) throw error;
        toast.success('Cartão adicionado');
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="card-name">Nome</Label>
          <Input
            id="card-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Inter, Nubank..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Bandeira</Label>
          <Select value={brand} onValueChange={(v) => setBrand(v ?? 'Visa')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {BRANDS.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Limite (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={limitAmount || ''}
          onChange={(e) => setLimitAmount(Number(e.target.value) || 0)}
          placeholder="0,00 (opcional)"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Dia de fechamento</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={closingDay}
            onChange={(e) => setClosingDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Dia de vencimento</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={dueDay}
            onChange={(e) => setDueDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Cor</Label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                color === c ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
              }`}
              style={{ background: c }}
              aria-label={`Cor ${c}`}
            />
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Salvando...' : isEdit ? 'Atualizar' : 'Adicionar'}
      </Button>
    </form>
  );
}
