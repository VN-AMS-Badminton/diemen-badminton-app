import { createServerSupabase } from "@/lib/supabase/server";

// Lazy cutoff resolver. Delegates to the `resolve_session_cutoff` Postgres
// RPC which is idempotent and atomic (FOR UPDATE on sessions row).
//
// Called from any path that reads or mutates a session's attendance state:
//   - dashboard SSR
//   - admin session detail SSR
//   - getNextSession()
//   - RSVP / cancel handlers
//
// Cheap on the pre-cutoff path (single row read + early return inside the RPC).
export async function resolveCutoffIfDue(sessionId: string): Promise<void> {
  const sb = createServerSupabase();
  const { error } = await sb.rpc("resolve_session_cutoff", {
    p_session_id: sessionId,
  });
  if (error) {
    // Don't surface to user; log for observability. Resolver re-runs idempotently.
    console.error("resolve_session_cutoff failed", {
      sessionId,
      error: error.message,
    });
  }
}
