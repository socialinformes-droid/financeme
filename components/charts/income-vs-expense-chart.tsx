'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { formatBRL } from '@/lib/format';

export type MonthlySummary = {
  month: string;
  label: string;
  income: number;
  expense: number;
};

export function IncomeVsExpenseChart({ data }: { data: MonthlySummary[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="oklch(0.78 0.02 80 / 0.4)" vertical={false} strokeDasharray="2 4" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            tickFormatter={(v) => `${(Number(v) / 1000).toFixed(1)}k`}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={42}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <Tooltip
            cursor={{ fill: 'oklch(0.92 0.011 82 / 0.4)' }}
            contentStyle={{
              background: 'oklch(0.992 0.005 90)',
              border: '1px solid oklch(0.86 0.012 82)',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
            }}
            formatter={(value) => formatBRL(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'var(--font-sans)' }} />
          <Bar dataKey="income" name="Entradas" fill="oklch(0.46 0.105 145)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="expense" name="Saídas" fill="oklch(0.48 0.16 30)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
