import { createClient } from '@/lib/supabase/server';
import type { ShoppingItemRow } from '@/lib/supabase/types';
import { ShoppingView } from './_view';

export const dynamic = 'force-dynamic';

export default async function ShoppingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('shopping_list')
    .select('*')
    .order('created_at', { ascending: false });

  return <ShoppingView userId={user.id} initial={(data ?? []) as ShoppingItemRow[]} />;
}
