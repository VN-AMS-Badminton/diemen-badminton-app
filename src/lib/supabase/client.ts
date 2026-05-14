import { createBrowserClient } from "@supabase/ssr";

// See server.ts for why we don't pass a Database generic.
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
