import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

// Append-only audit trail writer. `sb` is optional so library functions that
// inject a client for testability (passSlot, cancelBooking, …) can route the
// audit insert through the same (mock) client; all other callers fall back to
// a fresh server client. See docs/suggestion/refactor-write-audit-injectable-sb.md.
export async function writeAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
  sb?: SupabaseClient,
): Promise<void> {
  const client = sb ?? createServerSupabase();
  await client.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    before_json: (before ?? null) as never,
    after_json: (after ?? null) as never,
  });
}
