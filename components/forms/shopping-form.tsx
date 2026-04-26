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
import { Textarea } from '@/components/ui/textarea';
import type { Database, ShoppingItemRow } from '@/lib/supabase/types';

const CATEGORIES = [
  'Roupas',
  'Tecnologia',
  'Casa',
  'Cuidados',
  'Saúde',
  'Eletrodoméstico',
  'Fitness',
  'Acessórios',
  'Papelaria',
  'Outros',
];

type FormState = {
  name: string;
  quantity: number;
  price_min: number;
  price_max: number;
  reference_url: string;
  store_name: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  planned_month: string;
  notes: string;
};

export type ShoppingFormProps = {
  userId: string;
  editing?: ShoppingItemRow | null;
  onDone?: () => void;
};

export function ShoppingForm({ userId, editing, onDone }: ShoppingFormProps) {
  const isEdit = !!editing;
  const [submitting, setSubmitting] = useState(false);
  const [state, setState] = useState<FormState>({
    name: editing?.name ?? '',
    quantity: editing?.quantity ?? 1,
    price_min: Number(editing?.price_min ?? 0),
    price_max: Number(editing?.price_max ?? 0),
    reference_url: editing?.reference_url ?? '',
    store_name: editing?.store_name ?? '',
    category: editing?.category ?? 'Outros',
    priority: editing?.priority ?? 'medium',
    planned_month: editing?.planned_month ?? '',
    notes: editing?.notes ?? '',
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.name.trim()) {
      toast.error('Adicione um nome');
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      type Insert = Database['public']['Tables']['shopping_list']['Insert'];
      const payload: Insert = {
        user_id: userId,
        name: state.name.trim(),
        quantity: state.quantity,
        price_min: state.price_min || null,
        price_max: state.price_max || null,
        reference_url: state.reference_url.trim() || null,
        store_name: state.store_name.trim() || null,
        category: state.category,
        priority: state.priority,
        planned_month: state.planned_month || null,
        is_purchased: editing?.is_purchased ?? false,
        purchased_price: editing?.purchased_price ?? null,
        notes: state.notes.trim() || null,
      };
      if (isEdit && editing) {
        const { error } = await supabase
          .from('shopping_list')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Item atualizado');
      } else {
        const { error } = await supabase.from('shopping_list').insert(payload);
        if (error) throw error;
        toast.success('Item adicionado');
      }
      onDone?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="sl-name">Nome</Label>
        <Input
          id="sl-name"
          value={state.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Ex: Sapato branco, Esteira de corrida..."
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Qtde</Label>
          <Input
            type="number"
            min={1}
            value={state.quantity}
            onChange={(e) => set('quantity', Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>R$ mín</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={state.price_min || ''}
            onChange={(e) => set('price_min', Number(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>R$ máx</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={state.price_max || ''}
            onChange={(e) => set('price_max', Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Select value={state.category} onValueChange={(v) => set('category', v ?? 'Outros')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <Select
            value={state.priority}
            onValueChange={(v) => set('priority', (v as FormState['priority']) ?? 'medium')}
          >
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Média</SelectItem>
              <SelectItem value="low">Baixa</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Loja</Label>
          <Input
            value={state.store_name}
            onChange={(e) => set('store_name', e.target.value)}
            placeholder="Mercado Livre, Amazon..."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Mês planejado</Label>
          <Input
            type="month"
            value={state.planned_month ? state.planned_month.slice(0, 7) : ''}
            onChange={(e) => set('planned_month', e.target.value ? `${e.target.value}-01` : '')}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>URL de referência</Label>
        <Input
          type="url"
          value={state.reference_url}
          onChange={(e) => set('reference_url', e.target.value)}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea rows={2} value={state.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? 'Salvando...' : isEdit ? 'Atualizar' : 'Adicionar'}
      </Button>
    </form>
  );
}
