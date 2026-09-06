'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import type { TransactionRow, CardRow } from '@/lib/supabase/types';

interface BillChartsProps {
  cards: CardRow[];
  transactions: TransactionRow[];
}

const COLORS = [
  '#5a7d4f', '#7a9a5a', '#5a8a8a', '#6b4f7a', '#3f7a7a',
  '#b76e54', '#a84e3e', '#a85e7a', '#4e6e8e', '#5e6e8e',
];

export function BillChartsSection({ cards, transactions }: BillChartsProps) {
  // Gráfico 1: Faturas de Cartão
  const billChart = useMemo(() => {
    return cards
      .filter((c) => (c.bill_amount ?? 0) > 0)
      .map((card) => ({
        name: card.name,
        value: Number(card.bill_amount ?? 0),
      }));
  }, [cards]);

  // Gráfico 2: Transações Manuais (Débito/PIX/Cash)
  const manualChart = useMemo(() => {
    const data: Record<string, number> = {};

    transactions
      .filter((t) => t.type === 'expense' && t.payment_method !== 'credit')
      .forEach((t) => {
        const key = t.category;
        data[key] = (data[key] ?? 0) + Number(t.amount);
      });

    return Object.entries(data).map(([category, amount]) => ({
      name: category,
      value: amount,
    }));
  }, [transactions]);

  // Gráfico 3: Total (Cartão + Manual)
  const totalChart = useMemo(() => {
    const data: Record<string, number> = {};

    // Adiciona valores de cartão
    cards.forEach((card) => {
      const amount = Number(card.bill_amount ?? 0);
      if (amount > 0) {
        data['Cartões'] = (data['Cartões'] ?? 0) + amount;
      }
    });

    // Adiciona transações manuais por categoria
    transactions
      .filter((t) => t.type === 'expense' && t.payment_method !== 'credit')
      .forEach((t) => {
        const key = t.category;
        data[key] = (data[key] ?? 0) + Number(t.amount);
      });

    return Object.entries(data).map(([name, value]) => ({
      name,
      value,
    }));
  }, [cards, transactions]);

  const totalBill = billChart.reduce((sum, c) => sum + c.value, 0);
  const totalManual = manualChart.reduce((sum, c) => sum + c.value, 0);
  const totalAll = totalBill + totalManual;

  const ChartContainer = ({ title, data, amount }: any) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <p className="text-2xl font-bold text-accent mt-2">
          {amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado disponível
          </p>
        ) : (
          <div style={{ width: '100%', height: 300, minHeight: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {data.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) =>
                  (value as number).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                }
              />
              <Legend />
            </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ChartContainer title="💳 Cartões (Pierre)" data={billChart} amount={totalBill} />
        <ChartContainer
          title="🏦 Débito/PIX/Cash"
          data={manualChart}
          amount={totalManual}
        />
        <ChartContainer title="💰 Total Consolidado" data={totalChart} amount={totalAll} />
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          <strong>📊 Como funciona:</strong> O gráfico de Cartões mostra as faturas em aberto
          sincronizadas da Pierre. Os outros mostram suas transações manuais (sem duplicação com
          recorrentes).
        </p>
      </div>
    </div>
  );
}
