import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { seedInitialData } from '@/lib/seed';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileHeader } from '@/components/layout/mobile-header';
import { CalculatorFab } from '@/components/calculator-fab';
import { getAvailableYears } from '@/lib/domain/years';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auto-login');

  try {
    await seedInitialData(supabase, user.id);
  } catch (e) {
    console.error('[seed]', e);
  }

  const availableYears = await getAvailableYears(supabase);

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Sidebar availableYears={availableYears} />
      <MobileHeader availableYears={availableYears} />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>
      <CalculatorFab />
    </div>
  );
}
