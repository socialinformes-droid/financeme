'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  groupBulkFields,
  groupBulkValue,
  groupResize,
  groupReschedule,
  stripInstallmentSuffix,
  type GroupRow,
  type RowPatch,
} from '@/lib/domain/installments';
import { addMonthsToISO, formatBRL, formatMonthBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CardRow } from '@/lib/supabase/types';

type Method = 'credit' | 'debit' | 'pix' | 'cash';

export type InstallmentGroupFormProps = {
  rows: GroupRow[];
  cards: CardRow[];
  categories: ReadonlyArray<{ name: string }>;
  onDone?: () => void;
};

function monthsBetween(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.slice(0, 7).split('-').map(Number);
  const [ty, tm] = toIso.slice(0, 7).split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

async function applyPatches(patches: RowPatch[]): Promise<void> {
  if (patches.length === 0) return;
  const supabase = createClient();
  // Supabase não suporta bulk update com patches diferentes — uma chamada por linha.
  const results = await Promise.all(
    patches.map((p) => supabase.from('transactions').update(p.patch).eq('id', p.id)),
  );
  const firstError = results.find((r) => r.error)?.error;
  if (firstError) throw firstError;
}

export function InstallmentGroupForm({ rows, cards, categories, onDone }: InstallmentGroupFormProps) {
  const isRecurring = useMemo(
    () => rows.length > 0 && rows.every((r) => !r.is_installment && r.is_recurring),
    [rows],
  );
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (!isRecurring) return (a.installment_number ?? 0) - (b.installment_number ?? 0);
        return (a.billing_month ?? '').localeCompare(b.billing_month ?? '');
      }),
    [rows, isRecurring],
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const baseDescription = stripInstallmentSuffix(first?.description ?? '');
  const currentTotal = sorted.length;
  const currentPerAmount = first ? Math.abs(Number(first.amount)) : 0;
  const totalAmount = sorted.reduce((a, r) => a + Math.abs(Number(r.amount)), 0);
  const partLabelPlural = isRecurring ? 'ocorrência(s)' : 'parcela(s)';

  // ── Campos compartilhados ──
  const [description, setDescription] = useState(baseDescription);
  const [category, setCategory] = useState(first?.category ?? '');
  const [method, setMethod] = useState<Method>(first?.payment_method ?? 'credit');
  const [cardId, setCardId] = useState<string>(first?.card_id ?? '');
  const [fieldsIncludePaid, setFieldsIncludePaid] = useState(false);
  const [savingFields, setSavingFields] = useState(false);

  const onApplyFields = async () => {
    setSavingFields(true);
    try {
      const cleanDesc = stripInstallmentSuffix(description.trim());
      const fields: Parameters<typeof groupBulkFields>[0]['fields'] = {};
      if (cleanDesc !== baseDescription && cleanDesc.length > 0) fields.description = cleanDesc;
      if (category !== first.category) fields.category = category;
      if (method !== first.payment_method) fields.payment_method = method;
      const newCard = method === 'credit' ? cardId || null : null;
      if (newCard !== (first.card_id ?? null)) fields.card_id = newCard;

      const { toUpdate } = groupBulkFields({
        rows: sorted,
        fields,
        includePaid: fieldsIncludePaid,
      });
      if (toUpdate.length === 0) {
        toast.info('Nada pra atualizar');
        return;
      }
      await applyPatches(toUpdate);
      toast.success(`${toUpdate.length} ${partLabelPlural} atualizada(s)`);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSavingFields(false);
    }
  };

  // ── Reagendar ──
  const [newStart, setNewStart] = useState(first?.billing_month?.slice(0, 10) ?? '');
  const [reschedIncludePaid, setReschedIncludePaid] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const shift = first?.billing_month ? monthsBetween(first.billing_month, newStart || first.billing_month) : 0;
  const projectedEnd = last?.billing_month ? addMonthsToISO(last.billing_month, shift) : '';

  const onReschedule = async () => {
    if (!first?.billing_month) return;
    if (shift === 0) {
      toast.info('Mesma data de início');
      return;
    }
    setRescheduling(true);
    try {
      const { toUpdate } = groupReschedule({
        rows: sorted,
        shiftMonths: shift,
        includePaid: reschedIncludePaid,
      });
      await applyPatches(toUpdate);
      toast.success(`Reagendado em ${shift > 0 ? '+' : ''}${shift} mês(es)`);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao reagendar');
    } finally {
      setRescheduling(false);
    }
  };

  // ── Resize ──
  const [newTotal, setNewTotal] = useState(currentTotal);
  const [resizing, setResizing] = useState(false);
  const willEndAt = first?.billing_month
    ? addMonthsToISO(first.billing_month, Math.max(0, newTotal - 1))
    : '';

  const onResize = async () => {
    if (newTotal === currentTotal) {
      toast.info(isRecurring ? 'Mesmo número de meses' : 'Mesmo número de parcelas');
      return;
    }
    if (newTotal < 1) {
      toast.error(isRecurring ? 'Mínimo 1 mês' : 'Mínimo 1 parcela');
      return;
    }
    setResizing(true);
    try {
      const { toDelete, toInsert, toUpdate } = groupResize({
        rows: sorted,
        newTotal,
      });
      const supabase = createClient();
      if (toDelete.length > 0) {
        const { error } = await supabase.from('transactions').delete().in('id', toDelete);
        if (error) throw error;
      }
      if (toInsert.length > 0) {
        const { error } = await supabase.from('transactions').insert(toInsert);
        if (error) throw error;
      }
      await applyPatches(toUpdate);
      toast.success(
        toDelete.length > 0
          ? `Removidas ${toDelete.length} ${partLabelPlural}`
          : `Adicionadas ${toInsert.length} ${partLabelPlural}`,
      );
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao redimensionar');
    } finally {
      setResizing(false);
    }
  };

  // ── Valor por parcela ──
  const [newPerAmount, setNewPerAmount] = useState(currentPerAmount);
  const [valueIncludePaid, setValueIncludePaid] = useState(false);
  const [savingValue, setSavingValue] = useState(false);

  const onApplyValue = async () => {
    if (newPerAmount <= 0) {
      toast.error('Valor deve ser > 0');
      return;
    }
    setSavingValue(true);
    try {
      const { toUpdate } = groupBulkValue({
        rows: sorted,
        newAmount: newPerAmount,
        includePaid: valueIncludePaid,
      });
      if (toUpdate.length === 0) {
        toast.info('Nada pra atualizar');
        return;
      }
      await applyPatches(toUpdate);
      toast.success(`${toUpdate.length} ${partLabelPlural} atualizada(s)`);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSavingValue(false);
    }
  };

  // ── Excluir grupo ──
  const [deleting, setDeleting] = useState(false);

  const onDeleteGroup = async () => {
    const groupId = first?.installment_group_id;
    if (!groupId) return;
    const paidCount = sorted.filter((r) => r.is_paid).length;
    let includePaid = true;
    if (paidCount > 0) {
      const choice = confirm(
        `O grupo tem ${paidCount} ${partLabelPlural} já paga(s).\n\n` +
          `OK = excluir TUDO (incluindo as pagas).\n` +
          `Cancelar = manter as pagas (excluir só as pendentes).`,
      );
      includePaid = choice;
    } else {
      if (!confirm(isRecurring ? 'Excluir este lançamento recorrente?' : 'Excluir este grupo de parcelas?')) return;
    }
    setDeleting(true);
    try {
      const supabase = createClient();
      const ids = sorted.filter((r) => includePaid || !r.is_paid).map((r) => r.id);
      const { error } = await supabase.from('transactions').delete().in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} ${partLabelPlural} excluída(s)`);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

  if (!first) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-md bg-paper-dark/40 px-3 py-2 text-xs italic text-muted-foreground">
        Total atual: <span className="font-mono not-italic">{formatBRL(totalAmount)}</span>{' '}
        em <span className="font-mono not-italic">{currentTotal}</span>{' '}
        {isRecurring ? 'meses' : 'parcelas'} ·{' '}
        {formatMonthBR(first.billing_month ?? '')} → {formatMonthBR(last.billing_month ?? '')}
      </div>

      {/* ── Campos compartilhados ── */}
      <section className="space-y-3 rounded-md border border-rule/60 p-4">
        <p className="eyebrow">Campos compartilhados</p>
        <div className="space-y-1.5">
          <Label htmlFor="grp-desc">Descrição</Label>
          <Input
            id="grp-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {!isRecurring && (
            <p className="text-[11px] italic text-muted-foreground">
              O sufixo (N/M) é mantido automaticamente em cada parcela.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={(v) => setCategory(v ?? category)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.name} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Método</Label>
            <Select value={method} onValueChange={(v) => setMethod((v as Method) ?? method)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">Débito</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cash">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {method === 'credit' && (
          <div className="space-y-1.5">
            <Label>Cartão</Label>
            <Select value={cardId || '__none'} onValueChange={(v) => setCardId(!v || v === '__none' ? '' : v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— Sem cartão —</SelectItem>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <IncludePaidSwitch checked={fieldsIncludePaid} onChange={setFieldsIncludePaid} />
        <Button onClick={onApplyFields} disabled={savingFields} className="w-full">
          {savingFields ? 'Salvando...' : 'Aplicar mudanças'}
        </Button>
      </section>

      {/* ── Reagendar ── */}
      <section className="space-y-3 rounded-md border border-rule/60 p-4">
        <p className="eyebrow">Reagendar</p>
        <p className="text-xs italic text-muted-foreground">
          Move o mês de cobrança de cada parcela. Não muda a data de compra original.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="grp-start">Mês de início</Label>
          <Input
            id="grp-start"
            type="date"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
          />
          {shift !== 0 && (
            <p className="text-[11px] italic text-muted-foreground">
              Deslocamento de <span className="font-mono not-italic">{shift > 0 ? '+' : ''}{shift}</span>{' '}
              {Math.abs(shift) === 1 ? 'mês' : 'meses'} · termina em{' '}
              <span className="font-mono not-italic">{formatMonthBR(projectedEnd)}</span>
            </p>
          )}
        </div>
        <IncludePaidSwitch checked={reschedIncludePaid} onChange={setReschedIncludePaid} />
        <Button
          onClick={onReschedule}
          disabled={rescheduling || shift === 0}
          variant="outline"
          className="w-full"
        >
          {rescheduling ? 'Reagendando...' : 'Reagendar'}
        </Button>
      </section>

      {/* ── Total de parcelas / meses ── */}
      <section className="space-y-3 rounded-md border border-rule/60 p-4">
        <p className="eyebrow">{isRecurring ? 'Quantidade de meses' : 'Total de parcelas'}</p>
        <p className="text-xs italic text-muted-foreground">
          Aumentar adiciona ao final com mesmo valor. Reduzir remove as últimas{' '}
          (incluindo pagas).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="grp-total">{isRecurring ? 'Novo total de meses' : 'Novo total'}</Label>
            <Input
              id="grp-total"
              type="number"
              min={1}
              max={120}
              value={newTotal}
              onChange={(e) => setNewTotal(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Vai terminar em</Label>
            <p className="font-mono text-sm pt-2">
              {willEndAt ? formatMonthBR(willEndAt) : '—'}
            </p>
          </div>
        </div>
        <Button
          onClick={onResize}
          disabled={resizing || newTotal === currentTotal}
          variant="outline"
          className="w-full"
        >
          {resizing ? 'Aplicando...' : 'Aplicar'}
        </Button>
      </section>

      {/* ── Valor por parcela / mês ── */}
      <section className="space-y-3 rounded-md border border-rule/60 p-4">
        <p className="eyebrow">{isRecurring ? 'Valor mensal' : 'Valor por parcela'}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="grp-amount">Novo valor (R$)</Label>
            <Input
              id="grp-amount"
              type="number"
              step="0.01"
              min="0"
              value={newPerAmount}
              onChange={(e) => setNewPerAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Total resultante</Label>
            <p className="font-mono text-sm pt-2">
              {formatBRL(newPerAmount * currentTotal)}
            </p>
          </div>
        </div>
        <IncludePaidSwitch checked={valueIncludePaid} onChange={setValueIncludePaid} />
        <Button
          onClick={onApplyValue}
          disabled={savingValue || newPerAmount === currentPerAmount}
          variant="outline"
          className="w-full"
        >
          {savingValue ? 'Salvando...' : 'Aplicar'}
        </Button>
      </section>

      {/* ── Excluir grupo ── */}
      <section className="space-y-2 rounded-md border border-destructive/30 p-4">
        <p className="eyebrow text-destructive/80">Zona de perigo</p>
        <Button
          onClick={onDeleteGroup}
          disabled={deleting}
          variant="outline"
          className="w-full border-destructive/40 text-destructive hover:bg-destructive/5"
        >
          {deleting ? 'Excluindo...' : 'Excluir grupo'}
        </Button>
      </section>
    </div>
  );
}

function IncludePaidSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md bg-paper-dark/30 px-3 py-2">
      <div>
        <p className="text-xs font-medium">Incluir parcelas pagas</p>
        <p className="text-[11px] italic text-muted-foreground">
          Por padrão pagas ficam congeladas
        </p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
