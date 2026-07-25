import { createClient } from '@/lib/supabase/server';

/** Untyped RPC helper until `pnpm gen:types` regenerates Database Functions. */
export async function callRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: { message: string } | null }> {
  const supabase = await createClient();
  return (supabase as unknown as {
    rpc: (
      name: string,
      params: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc(fn, args);
}
