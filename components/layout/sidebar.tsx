'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase/client';

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; phase?: number };

const NAV: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transações', icon: ArrowDownUp },
  { href: '/cards', label: 'Cartões', icon: CreditCard, phase: 2 },
  { href: '/installments', label: 'Parcelas', icon: ListChecks, phase: 2 },
  { href: '/shopping', label: 'Compras', icon: ShoppingBag, phase: 2 },
  { href: '/forecast', label: 'Previsão', icon: TrendingUp, phase: 3 },
  { href: '/settings', label: 'Config', icon: Settings, phase: 3 },
];

export function Sidebar({ email }: { email?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const onLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5">
        <h1 className="text-lg font-semibold tracking-tight">Financeiro</h1>
        <p className="text-xs text-muted-foreground">Controle pessoal</p>
      </div>
      <Separator />
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const disabled = !!item.phase;
          return (
            <Link
              key={item.href}
              href={disabled ? '#' : item.href}
              aria-disabled={disabled}
              onClick={(e) => disabled && e.preventDefault()}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'hover:bg-sidebar-accent/60 text-sidebar-foreground/80',
                disabled && 'opacity-40 cursor-not-allowed',
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.phase && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  F{item.phase}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <Separator />
      <div className="px-3 py-3 space-y-2">
        {email && <p className="px-2 text-xs text-muted-foreground truncate" title={email}>{email}</p>}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={onLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
}
