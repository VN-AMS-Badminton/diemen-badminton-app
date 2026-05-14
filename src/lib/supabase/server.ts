import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client using the service role key.
// NEVER import this in client components.
// All server actions and API routes go through this client; RLS is defense-in-depth.
// Note: we deliberately do NOT pass a Database generic — the SDK's strict
// table-shape inference fights with the (Row/Insert/Update) shape and adds
// noise without catching real bugs. App code uses the hand-written types in
// `@/lib/db/types` directly when needed.
export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server env vars");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
