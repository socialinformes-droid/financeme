'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSidebarState } from '@/hooks/use-sidebar-state';
import { SidebarToggle } from './sidebar-toggle';

function useClientCookieYear(): string | null {
  const [year, setYear] = useState<string | null>(null);
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)selected_year=(\d{4})/);
    setYear(m ? m[1] : null);
  }, []);
  return year;
}
import {
  LayoutDashboard,
  ArrowDownUp,
  CreditCard,
  ListChecks,
  ShoppingBag,
  TrendingUp,
  Settings,
  LogOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { YearSwitcher } from '@/components/layout/year-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { createClient } from '@/lib/supabase/client';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; phase?: number };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Lançamentos', icon: ArrowDownUp },
  { href: '/cards', label: 'Cartões', icon: CreditCard },
  { href: '/installments', label: 'Parcelas', icon: ListChecks },
  { href: '/shopping', label: 'Compras', icon: ShoppingBag },
  { href: '/forecast', label: 'Previsão', icon: TrendingUp },
  { href: '/settings', label: 'Edição', icon: Settings },
];

export function Sidebar({
  availableYears,
  userEmail,
}: {
  availableYears: number[];
  userEmail?: string | null;
}) {
  const { isExpanded, isHydrated } = useSidebarState();

  if (!isHydrated) return null;

  return (
    <aside
      className={cn(
        'hidden md:flex shrink-0 sticky top-0 h-svh flex-col border-r border-rule/60 bg-sidebar text-sidebar-foreground transition-all duration-200',
        isExpanded ? 'w-64' : 'w-16'
      )}
    >
      <SidebarContent availableYears={availableYears} userEmail={userEmail} />
    </aside>
  );
}

export function SidebarContent({
  availableYears,
  onNavigate,
  userEmail,
}: {
  availableYears: number[];
  onNavigate?: () => void;
  isMobile?: boolean;
  userEmail?: string | null;
}) {
  const router = useRouter();
  const { isExpanded, toggleSidebar, isHydrated } = useSidebarState();

  if (!isHydrated) return null;

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cookieYear = useClientCookieYear();
  const yearParam = searchParams.get('year') ?? cookieYear;
  const linkHref = (href: string) => (yearParam ? `${href}?year=${yearParam}` : href);
  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const defaultYear = new Date().getFullYear();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toggle button */}
      <div className="px-3 pt-2 pb-2 shrink-0">
        <SidebarToggle isExpanded={isExpanded} onToggle={toggleSidebar} />
      </div>

      {/* Masthead */}
      <div
        className={cn(
          'border-b border-rule/40 shrink-0 transition-all duration-200 overflow-hidden',
          isExpanded
            ? 'px-5 pt-5 pb-5'
            : 'px-3 py-2'
        )}
      >
        {isExpanded && (
          <>
            <p className="eyebrow mb-1">Edição diária</p>
            <h1 className="headline text-[28px] leading-none tracking-tight font-medium">
              Caderno
              <span className="block italic font-light text-foreground/70 -mt-0.5">Financeiro</span>
            </h1>
            <p className="mt-3 text-[11px] font-mono text-muted-foreground/80 lowercase first-letter:uppercase">
              {today}
            </p>
          </>
        )}
      </div>

      {/* Year switcher */}
      {isExpanded && (
        <div className="px-5 py-4 border-b border-rule/40 shrink-0">
          <YearSwitcher availableYears={availableYears} defaultYear={defaultYear} />
        </div>
      )}

      {/* Nav — fixa, sem scroll */}
      <nav
        className={cn(
          'shrink-0 transition-all duration-200',
          isExpanded ? 'px-3 py-4' : 'px-1 py-4'
        )}
      >
        {isExpanded && (
          <p className="eyebrow px-2 mb-2">Seções</p>
        )}
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const disabled = !!item.phase;
            return (
              <li key={item.href}>
                <Link
                  href={disabled ? '#' : linkHref(item.href)}
                  aria-disabled={disabled}
                  title={!isExpanded ? item.label : undefined}
                  onClick={(e) => {
                    if (disabled) {
                      e.preventDefault();
                      return;
                    }
                    onNavigate?.();
                  }}
                  className={cn(
                    'group flex items-center gap-3 rounded-md text-sm transition-colors',
                    isExpanded ? 'px-2.5 py-2' : 'px-2 py-2 justify-center',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-foreground/75 hover:bg-sidebar-accent/50 hover:text-foreground',
                    disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  {isExpanded && (
                    <>
                      <span className="flex-1 leading-none">{item.label}</span>
                      {active && <span className="text-primary text-[10px]">●</span>}
                      {item.phase && (
                        <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/60">
                          Cap. {item.phase}
                        </span>
                      )}
                    </>
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
      <div
        className={cn(
          'border-t border-rule/40 space-y-3 shrink-0 transition-all duration-200',
          isExpanded
            ? 'px-5 py-4'
            : 'px-2 py-4'
        )}
      >
        <div className={isExpanded ? '' : 'flex justify-center'}>
          <ThemeToggle />
        </div>

        {isExpanded && userEmail && (
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
              Editor
            </p>
            <p className="text-[11px] font-mono text-foreground/80 truncate" title={userEmail}>
              {userEmail}
            </p>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="h-3 w-3" />
              <span>Sair</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
