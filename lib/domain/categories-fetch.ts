import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, CategoryRow } from '@/lib/supabase/types';

/**
 * Busca categorias ativas do user logado, ordenadas por nome.
 * Use só em Server Components / Route Handlers (precisa de auth).
 */
export async function fetchUserCategories(
  supabase: SupabaseClient<Database>,
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) {
    console.error('[fetchUserCategories]', error);
    return [];
  }
  return data ?? [];
}
