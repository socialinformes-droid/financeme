import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { seedInitialData } from '@/lib/seed';
import { Sidebar } from '@/components/layout/sidebar';
import { CalculatorFab } from '@/components/calculator-fab';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy garante user no caminho normal — fallback caso algo escape.
  if (!user) redirect('/auto-login');

  // Seed idempotente — só roda na 1ª sessão
  try {
    await seedInitialData(supabase, user.id);
  } catch (e) {
    console.error('[seed]', e);
  }

  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</div>
      </main>
      <CalculatorFab />
    </div>
  );
}
