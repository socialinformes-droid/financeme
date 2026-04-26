'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ArrowDownUp,
  CreditCard,
  ListChecks,
  ShoppingBag,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { YearSwitcher } from '@/components/layout/year-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; phase?: number };

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Lançamentos', icon: ArrowDownUp },
  { href: '/cards', label: 'Cartões', icon: CreditCard },
  { href: '/installments', label: 'Parcelas', icon: ListChecks },
  { href: '/shopping', label: 'Compras', icon: ShoppingBag },
  { href: '/forecast', label: 'Previsão', icon: TrendingUp },
  { href: '/settings', label: 'Edição', icon: Settings },
];

export function Sidebar({ availableYears }: { availableYears: number[] }) {
  return (
    <aside className="hidden md:flex w-60 shrink-0 sticky top-0 h-svh flex-col border-r border-rule/60 bg-sidebar text-sidebar-foreground">
      <SidebarContent availableYears={availableYears} />
    </aside>
  );
}

export function SidebarContent({
  availableYears,
  onNavigate,
  isMobile = false,
}: {
  availableYears: number[];
  onNavigate?: () => void;
  isMobile?: boolean;
}) {
  const pathname = usePathname();
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const defaultYear = new Date().getFullYear();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Masthead */}
      <div className="px-5 pt-7 pb-5 border-b border-rule/40 shrink-0">
        <p className="eyebrow mb-1">Edição diária</p>
        <h1 className="headline text-[28px] leading-none tracking-tight font-medium">
          Caderno
          <span className="block italic font-light text-foreground/70 -mt-0.5">Financeiro</span>
        </h1>
        <p className="mt-3 text-[11px] font-mono text-muted-foreground/80 lowercase first-letter:uppercase">
          {today}
        </p>
      </div>

      {/* Year switcher */}
      <div className="px-5 py-4 border-b border-rule/40 shrink-0">
        <YearSwitcher availableYears={availableYears} defaultYear={defaultYear} />
      </div>

      {/* Nav — fixa, sem scroll */}
      <nav className="px-3 py-4 shrink-0">
        <p className="eyebrow px-2 mb-2">Seções</p>
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const disabled = !!item.phase;
            return (
              <li key={item.href}>
                <Link
                  href={disabled ? '#' : item.href}
                  aria-disabled={disabled}
                  onClick={(e) => {
                    if (disabled) {
                      e.preventDefault();
                      return;
                    }
                    onNavigate?.();
                  }}
                  className={cn(
                    'group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-foreground/75 hover:bg-sidebar-accent/50 hover:text-foreground',
                    disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1 leading-none">{item.label}</span>
                  {active && <span className="text-primary text-[10px]">●</span>}
                  {item.phase && (
                    <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/60">
                      Cap. {item.phase}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Espaçador flexível */}
      <div className="flex-1 min-h-0" />

      {/* Footer */}
      <div className="px-5 py-4 border-t border-rule/40 space-y-3 shrink-0">
        <ThemeToggle />
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Almanaque pessoal
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/60 italic font-display">
            ano {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
