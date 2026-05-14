import { createServerSupabase } from "@/lib/supabase/server";

export async function writeAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const sb = createServerSupabase();
  await sb.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    before_json: (before ?? null) as never,
    after_json: (after ?? null) as never,
  });
}
