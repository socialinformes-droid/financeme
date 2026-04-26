'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatBRL } from '@/lib/format';
import { CATEGORY_COLOR } from '@/lib/domain/categories';

export type CategorySlice = { category: string; value: number };

export function CategoryPieChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
        Sem gastos no mês
      </div>
    );
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="category"
            innerRadius={48}
            outerRadius={86}
            paddingAngle={2}
            stroke="oklch(0.992 0.005 90)"
            strokeWidth={2}
          >
            {data.map((d) => (
              <Cell
                key={d.category}
                fill={CATEGORY_COLOR[d.category as keyof typeof CATEGORY_COLOR] ?? '#8a8580'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'oklch(0.992 0.005 90)',
              border: '1px solid oklch(0.86 0.012 82)',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'var(--font-sans)',
            }}
            formatter={(value) => formatBRL(Number(value))}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
