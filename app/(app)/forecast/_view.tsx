'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBRL, formatMonthBR } from '@/lib/format';
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
import type { ForecastMonth } from './page';

type WhatIfItem = {
  id: string;
  description: string;
  amount: number; // positivo = entrada, negativo = saída
  month: string; // YYYY-MM-01
};

export function ForecastView({
  year,
  months,
  projectedIncomeMonth,
  variableEstimateMonth,
  declaredIncome,
  incomeAvg,
}: {
  year: number;
  months: ForecastMonth[];
  projectedIncomeMonth: number;
  variableEstimateMonth: number;
  declaredIncome: number;
  incomeAvg: number;
}) {
  const [salaryDelta, setSalaryDelta] = useState(0); // % adicional no salário projetado
  const [whatIfs, setWhatIfs] = useState<WhatIfItem[]>([]);
  const [newDesc, setNewDesc] = useState('');
  const [newAmount, setNewAmount] = useState(0);
  const [newType, setNewType] = useState<'income' | 'expense'>('expense');
  const [newMonth, setNewMonth] = useState(months.find((m) => !m.isPast)?.month ?? months[0].month);

  // Calcula linha por mês
  const enriched = useMemo(() => {
    const rows: Array<{
      month: string;
      isPast: boolean;
      isCurrent: boolean;
      income: number;
      expenseFixed: number;
      expenseVariable: number;
      installments: number;
      whatIfIncome: number;
      whatIfExpense: number;
      total: number;
    }> = [];

    for (const m of months) {
      const whatIfMonth = whatIfs.filter((w) => w.month === m.month);
      const whatIfIncome = whatIfMonth.filter((w) => w.amount > 0).reduce((a, w) => a + w.amount, 0);
      const whatIfExpense = whatIfMonth.filter((w) => w.amount < 0).reduce((a, w) => a + Math.abs(w.amount), 0);

      let income: number;
      let expenseFixed: number;
      let expenseVariable: number;

      if (m.isPast || m.isCurrent) {
        income = m.realIncome;
        expenseFixed = m.realExpense;
        expenseVariable = 0;
      } else {
        income = m.projectedIncome * (1 + salaryDelta / 100);
        expenseFixed = m.projectedFixed; // parcelas
        expenseVariable = m.projectedVariable; // média 3m das outras saídas
      }

      const total = income + whatIfIncome - expenseFixed - expenseVariable - whatIfExpense;
      rows.push({
        month: m.month,
        isPast: m.isPast,
        isCurrent: m.isCurrent,
        income,
        expenseFixed,
        expenseVariable,
        installments: m.projectedFixed,
        whatIfIncome,
        whatIfExpense,
        total,
      });
    }
    // Acumular saldo
    let acc = 0;
    return rows.map((r) => {
      acc += r.total;
      return { ...r, accumulated: acc };
    });
  }, [months, whatIfs, salaryDelta]);

  const yearTotal = enriched[enriched.length - 1]?.accumulated ?? 0;
  const yearTotalNoWhatIf = useMemo(() => {
    let acc = 0;
    for (const m of months) {
      if (m.isPast || m.isCurrent) {
        acc += m.realIncome - m.realExpense;
      } else {
        acc +=
          m.projectedIncome - m.projectedFixed - m.projectedVariable;
      }
    }
    return acc;
  }, [months]);

  const addWhatIf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc.trim() || !newAmount) return;
    const sign = newType === 'income' ? 1 : -1;
    setWhatIfs((s) => [
      ...s,
      {
        id: crypto.randomUUID(),
        description: newDesc.trim(),
        amount: Math.abs(newAmount) * sign,
        month: newMonth,
      },
    ]);
    setNewDesc('');
    setNewAmount(0);
  };

  const removeWhatIf = (id: string) =>
    setWhatIfs((s) => s.filter((w) => w.id !== id));

  const reset = () => {
    setSalaryDelta(0);
    setWhatIfs([]);
  };

  const futureMonths = months.filter((m) => !m.isPast && !m.isCurrent);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 pb-4 border-b border-rule/60">
        <div>
          <p className="eyebrow">Caderno de</p>
          <h2 className="headline text-4xl font-light tracking-tight">Previsão</h2>
          <p className="text-xs italic text-muted-foreground mt-1.5">
            <span className="font-mono not-italic mr-1">{year}</span> · projeção baseada na média dos últimos 3 meses + parcelas em aberto
          </p>
        </div>
        {(salaryDelta !== 0 || whatIfs.length > 0) && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Limpar simulação
          </Button>
        )}
      </header>

      {/* Cards resumo */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-px bg-rule/60 border border-rule/60 rounded-lg overflow-hidden">
        <SummaryCard
          label="Renda projetada/mês"
          value={projectedIncomeMonth * (1 + salaryDelta / 100)}
          accent="green"
          hint={
            salaryDelta !== 0
              ? `${salaryDelta > 0 ? '+' : ''}${salaryDelta}% sobre ${formatBRL(projectedIncomeMonth)}`
              : incomeAvg > declaredIncome
                ? `média 3m (declarada: ${formatBRL(declaredIncome)})`
                : `declarada (média 3m: ${formatBRL(incomeAvg)})`
          }
        />
        <SummaryCard
          label="Saída variável/mês"
          value={-variableEstimateMonth}
          accent="red"
          hint="média 3 meses sem parcelas"
        />
        <SummaryCard
          label="+ Parcelas (varia/mês)"
          value={
            -months
              .filter((m) => !m.isPast && !m.isCurrent)
              .reduce((a, m) => a + m.projectedFixed, 0) /
            Math.max(1, months.filter((m) => !m.isPast && !m.isCurrent).length)
          }
          accent="red"
          hint="média mensal das parcelas ativas"
        />
        <SummaryCard
          label="Saldo projetado fim de ano"
          value={yearTotal}
          accent={yearTotal >= 0 ? 'green' : 'red'}
          hint={
            whatIfs.length > 0 || salaryDelta !== 0
              ? `sem simulação: ${formatBRL(yearTotalNoWhatIf)}`
              : undefined
          }
        />
      </section>

      {/* Tabela mensal */}
      <section>
        <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
          <div>
            <p className="eyebrow mb-1">Caderno principal</p>
            <h3 className="headline text-2xl font-medium tracking-tight">Mês a mês</h3>
          </div>
          <p className="text-xs italic text-muted-foreground pb-1">
            Passado em tom firme · futuro em itálico
          </p>
        </div>

        <div className="rounded-md border border-rule/70 bg-card overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="bg-paper-dark/50">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium border-b-2 border-rule/80">
                  <span className="eyebrow">Mês</span>
                </th>
                <th className="px-2 py-2.5 text-right font-medium border-b-2 border-rule/80">
                  <span className="eyebrow">Entrada</span>
                </th>
                <th className="px-2 py-2.5 text-right font-medium border-b-2 border-rule/80">
                  <span className="eyebrow">Fixa</span>
                </th>
                <th className="px-2 py-2.5 text-right font-medium border-b-2 border-rule/80">
                  <span className="eyebrow">Variável</span>
                </th>
                <th className="px-2 py-2.5 text-right font-medium border-b-2 border-rule/80">
                  <span className="eyebrow">"E se"</span>
                </th>
                <th className="px-3 py-2.5 text-right font-medium border-b-2 border-rule/80 bg-paper-dark/40">
                  <span className="eyebrow">Saldo</span>
                </th>
                <th className="px-3 py-2.5 text-right font-medium border-b-2 border-rule/80 bg-paper-dark/60">
                  <span className="eyebrow">Acumulado</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((r) => {
                const whatIfNet = r.whatIfIncome - r.whatIfExpense;
                return (
                  <tr
                    key={r.month}
                    className={cn(
                      'border-b border-rule/30 hover:bg-paper-dark/15',
                      r.isCurrent && 'bg-accent/20',
                      !r.isPast && !r.isCurrent && 'italic',
                    )}
                  >
                    <td className="px-3 py-2 font-medium not-italic">
                      <span className="font-display italic">{formatMonthBR(r.month)}</span>
                      {r.isCurrent && <span className="ml-1.5 text-[9px] eyebrow text-foreground">agora</span>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-money-up/85">
                      {r.income > 0 ? formatNum(r.income) : '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-money-down/85">
                      {r.expenseFixed > 0 ? `(${formatNum(r.expenseFixed)})` : '—'}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-money-down/85">
                      {r.expenseVariable > 0 ? `(${formatNum(r.expenseVariable)})` : '—'}
                    </td>
                    <td
                      className={cn(
                        'px-2 py-2 text-right tabular-nums',
                        whatIfNet > 0
                          ? 'text-money-up/85'
                          : whatIfNet < 0
                            ? 'text-money-down/85'
                            : 'text-muted-foreground/40',
                      )}
                    >
                      {whatIfNet === 0
                        ? '—'
                        : whatIfNet > 0
                          ? formatNum(whatIfNet)
                          : `(${formatNum(Math.abs(whatIfNet))})`}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums font-medium bg-paper-dark/30',
                        r.total > 0 ? 'text-money-up' : r.total < 0 ? 'text-money-down' : 'text-muted-foreground/50',
                      )}
                    >
                      {r.total === 0
                        ? '—'
                        : r.total > 0
                          ? `+${formatNum(r.total)}`
                          : `(${formatNum(Math.abs(r.total))})`}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-2 text-right tabular-nums font-semibold bg-paper-dark/50',
                        r.accumulated > 0
                          ? 'text-money-up'
                          : r.accumulated < 0
                            ? 'text-money-down'
                            : 'text-muted-foreground/50',
                      )}
                    >
                      {r.accumulated === 0
                        ? '—'
                        : r.accumulated > 0
                          ? `+${formatNum(r.accumulated)}`
                          : `(${formatNum(Math.abs(r.accumulated))})`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Simulador */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Slider salário */}
        <div>
          <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
            <div>
              <p className="eyebrow mb-1">Suplemento</p>
              <h3 className="headline text-2xl font-medium tracking-tight">E se o salário…</h3>
            </div>
            <p className="text-xs italic text-muted-foreground pb-1">
              ajusta a renda recorrente projetada
            </p>
          </div>

          <div className="rounded-lg border border-rule/60 bg-card p-5 space-y-4">
            <div>
              <div className="flex items-end justify-between mb-2">
                <Label htmlFor="salary-delta" className="text-sm">
                  Variação no salário projetado
                </Label>
                <span
                  className={cn(
                    'font-mono text-lg tabular-nums',
                    salaryDelta > 0 ? 'text-money-up' : salaryDelta < 0 ? 'text-money-down' : 'text-foreground',
                  )}
                >
                  {salaryDelta > 0 ? '+' : ''}{salaryDelta}%
                </span>
              </div>
              <input
                id="salary-delta"
                type="range"
                min={-50}
                max={100}
                step={5}
                value={salaryDelta}
                onChange={(e) => setSalaryDelta(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1 font-mono">
                <span>-50%</span>
                <span>0</span>
                <span>+100%</span>
              </div>
            </div>
            <div className="text-xs text-muted-foreground italic">
              Salário projetado:{' '}
              <span className="font-mono not-italic text-foreground">
                {formatBRL(projectedIncomeMonth * (1 + salaryDelta / 100))}/mês
              </span>
              {salaryDelta !== 0 && (
                <span className="ml-1.5">
                  (era {formatBRL(projectedIncomeMonth)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Adicionar gasto pontual */}
        <div>
          <div className="flex items-end justify-between gap-3 pb-2 border-b border-rule/40 mb-3">
            <div>
              <p className="eyebrow mb-1">Suplemento</p>
              <h3 className="headline text-2xl font-medium tracking-tight">Gasto pontual</h3>
            </div>
            <p className="text-xs italic text-muted-foreground pb-1">
              adiciona uma linha "e se" em um mês futuro
            </p>
          </div>

          <div className="rounded-lg border border-rule/60 bg-card p-5">
            <form onSubmit={addWhatIf} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={newType}
                  onValueChange={(v) => setNewType((v as 'income' | 'expense') ?? 'expense')}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Saída</SelectItem>
                    <SelectItem value="income">Entrada</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={newMonth} onValueChange={(v) => setNewMonth(v ?? newMonth)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {futureMonths.map((m) => (
                      <SelectItem key={m.month} value={m.month}>
                        {formatMonthBR(m.month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Descrição (ex: notebook novo)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={newAmount || ''}
                  onChange={(e) => setNewAmount(Number(e.target.value) || 0)}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={!newDesc.trim() || !newAmount}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
            </form>

            {whatIfs.length > 0 && (
              <ul className="mt-4 pt-4 border-t border-rule/40 space-y-1.5">
                {whatIfs.map((w) => (
                  <li
                    key={w.id}
                    className="flex items-center justify-between text-sm gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{w.description}</p>
                      <p className="text-[11px] italic text-muted-foreground">
                        {formatMonthBR(w.month)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'font-mono tabular-nums text-xs',
                        w.amount > 0 ? 'text-money-up' : 'text-money-down',
                      )}
                    >
                      {w.amount > 0 ? '+' : ''}
                      {formatBRL(w.amount)}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => removeWhatIf(w.id)}
                      title="Remover"
                    >
                      <Trash2 className="h-3 w-3 text-money-down" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string;
  value: number;
  accent: 'green' | 'red';
  hint?: string;
}) {
  const colorClass = accent === 'green' ? 'text-money-up' : 'text-money-down';
  return (
    <div className="bg-card px-5 py-4">
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 font-mono text-xl tabular-nums ${colorClass}`}>{formatBRL(value)}</p>
      {hint && <p className="text-[10px] italic text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function formatNum(v: number): string {
  return Math.round(v).toLocaleString('pt-BR');
}
