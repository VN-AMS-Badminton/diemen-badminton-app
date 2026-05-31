import { createServerSupabase } from "@/lib/supabase/server";

export interface SessionTrialInfo {
  trialQuota: number;
  trialUsed: number;
  trialRemaining: number;
}

export async function getSessionTrialInfo(
  sessionId: string,
): Promise<SessionTrialInfo> {
  const sb = createServerSupabase();
  const [sessRes, countRes] = await Promise.all([
    sb.from("sessions").select("trial_quota").eq("id", sessionId).maybeSingle(),
    sb
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("source", "referral")
      .eq("rsvp_status", "in"),
  ]);
  const trialQuota = sessRes.data?.trial_quota ?? 4;
  const trialUsed = countRes.count ?? 0;
  return { trialQuota, trialUsed, trialRemaining: Math.max(0, trialQuota - trialUsed) };
}
