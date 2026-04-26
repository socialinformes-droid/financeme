import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Auto-login transparente: tenta logar com FINANCEIRO_EMAIL/PASSWORD.
 * Se a conta não existir, cria via service role (sem precisar confirmar email)
 * e loga em seguida. Sem UI.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/';

  const email = process.env.FINANCEIRO_EMAIL;
  const password = process.env.FINANCEIRO_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !password || !supabaseUrl || !serviceKey) {
    return new NextResponse(
      'Faltam variáveis de ambiente (FINANCEIRO_EMAIL, FINANCEIRO_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
      { status: 500 },
    );
  }

  const supabase = await createServerClient();

  // 1ª tentativa: login com credenciais existentes
  const first = await supabase.auth.signInWithPassword({ email, password });
  if (!first.error) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Falhou — provavelmente conta não existe. Criar via service role e relogar.
  const admin = createSupabaseClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  // "User already registered" = senha errada. "Email signups disabled" = config no dashboard.
  if (createError && !/already registered|already exists/i.test(createError.message)) {
    return new NextResponse(
      `Erro criando usuário: ${createError.message}. Verifique se Email signups estão habilitados no Supabase Auth.`,
      { status: 500 },
    );
  }

  const second = await supabase.auth.signInWithPassword({ email, password });
  if (second.error) {
    return new NextResponse(
      `Erro no login após criar usuário: ${second.error.message}`,
      { status: 500 },
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
