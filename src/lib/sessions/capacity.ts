import { createServerSupabase } from "@/lib/supabase/server";

export async function getRemainingSlots(sessionId: string): Promise<{
  capacity: number;
  confirmed: number;
  remaining: number;
}> {
  const sb = createServerSupabase();
  const [session, count] = await Promise.all([
    sb.from("sessions").select("capacity").eq("id", sessionId).maybeSingle(),
    sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("rsvp_status", "in"),
  ]);
  const capacity = session.data?.capacity ?? 0;
  const confirmed = count.count ?? 0;
  return { capacity, confirmed, remaining: Math.max(0, capacity - confirmed) };
}
