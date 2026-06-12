import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
  // Optional injected client (enables DI for unit tests); defaults to the
  // service-role server client for normal request paths.
  client?: SupabaseClient,
): Promise<void> {
  const sb = client ?? createServerSupabase();
  await sb.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    before_json: (before ?? null) as never,
    after_json: (after ?? null) as never,
  });
}
