const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBRL(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'R$ 0,00';
  const n = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(n)) return 'R$ 0,00';
  return brl.format(n);
}

export function formatBRLSigned(value: number): string {
  const sign = value >= 0 ? '+' : '−';
  return `${sign} ${brl.format(Math.abs(value))}`;
}

export function formatDateBR(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function formatMonthBR(input: string | Date | null | undefined): string {
  if (!input) return '';
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).replace('.', '');
}

export function toMonthDate(year: number, monthZeroBased: number): string {
  const yyyy = String(year).padStart(4, '0');
  const mm = String(monthZeroBased + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

export function firstDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

export function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
