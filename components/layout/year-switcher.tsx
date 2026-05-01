'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const YEAR_COOKIE = 'selected_year';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function useClientCookieYear(): number | null {
  const [y, setY] = useState<number | null>(null);
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)selected_year=(\d{4})/);
    setY(m ? Number(m[1]) : null);
  }, []);
  return y;
}

function writeCookieYear(y: number) {
  document.cookie = `${YEAR_COOKIE}=${y}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

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
  const urlYear = Number(searchParams.get('year'));
  const cookieYear = useClientCookieYear();
  const current =
    Number.isFinite(urlYear) && urlYear > 0
      ? urlYear
      : cookieYear ?? defaultYear;

  // Sync URL → cookie sempre que ?year= aparecer (fresh load com URL pré-formada).
  useEffect(() => {
    const yParam = searchParams.get('year');
    if (yParam && /^\d{4}$/.test(yParam)) writeCookieYear(Number(yParam));
  }, [searchParams]);

  const setYear = (yStr: string | null) => {
    if (!yStr) return;
    const y = Number(yStr);
    if (!Number.isFinite(y)) return;
    writeCookieYear(y);
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', String(y));
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  };

  // Garante que o ano corrente sempre aparece na lista, mesmo se ainda não houver dados nele.
  const optionYears = [...new Set([...availableYears, defaultYear, current])].sort((a, b) => a - b);

  return (
    <div className="space-y-1.5">
      <p className="eyebrow">Ano</p>
      <Select value={String(current)} onValueChange={setYear}>
        <SelectTrigger className="w-full h-9 font-display text-lg tabular-nums">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {optionYears.map((y) => (
            <SelectItem key={y} value={String(y)} className="font-mono">
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
