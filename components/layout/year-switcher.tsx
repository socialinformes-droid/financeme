'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function YearSwitcher({
  availableYears,
  defaultYear,
}: {
  availableYears: number[];
  defaultYear: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = Number(searchParams.get('year')) || defaultYear;

  const setYear = (y: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (y === defaultYear) params.delete('year');
    else params.set('year', String(y));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const idx = availableYears.indexOf(current);
  const prev = idx > 0 ? availableYears[idx - 1] : null;
  const next = idx < availableYears.length - 1 ? availableYears[idx + 1] : null;

  return (
    <div className="space-y-1.5">
      <p className="eyebrow">Volume</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => prev !== null && setYear(prev)}
          disabled={prev === null}
          className={cn(
            'h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50',
            'disabled:opacity-30 disabled:pointer-events-none',
          )}
          aria-label="Ano anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="font-display text-2xl tracking-tight tabular-nums w-14 text-center">
          {current}
        </span>
        <button
          type="button"
          onClick={() => next !== null && setYear(next)}
          disabled={next === null}
          className={cn(
            'h-7 w-7 inline-flex items-center justify-center rounded-md transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50',
            'disabled:opacity-30 disabled:pointer-events-none',
          )}
          aria-label="Próximo ano"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      {availableYears.length > 1 && (
        <div className="flex gap-1 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={cn(
                'shrink-0 text-[11px] font-mono px-1.5 py-0.5 rounded-sm transition-colors',
                y === current
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {y}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
