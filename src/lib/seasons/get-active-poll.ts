import { createServerSupabase } from "@/lib/supabase/server";
import type { SeasonRow } from "@/lib/db/types";

export async function getActivePoll(): Promise<SeasonRow | null> {
  const sb = createServerSupabase();
  const nowIso = new Date().toISOString();
  const { data } = await sb
    .from("seasons")
    .select("*")
    .eq("status", "poll")
    .lte("poll_opens_at", nowIso)
    .gte("poll_closes_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
