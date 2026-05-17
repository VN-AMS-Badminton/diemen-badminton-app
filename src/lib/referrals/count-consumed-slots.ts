import { createServerSupabase } from "@/lib/supabase/server";

// Count how many referral slots a member has consumed in the current calendar
// month (Europe/Amsterdam). "Consumed" = an attendance row whose guest signed
// up via referral and is still counted against the referrer's cap. Bumped
// rows have cap_consumed=false (if same-month) and are excluded.
//
// Implementation: join attendance → players to filter by referred_by; cap
// counting cares about *when the referral was created*, not when the session
// runs.
export async function countConsumedSlotsThisMonth(
  referrerId: string,
): Promise<number> {
  const sb = createServerSupabase();

  // Month boundaries computed in Amsterdam time, converted to UTC for the
  // attendance.created_at filter.
  const { from, to } = monthRangeAmsterdamUtc(new Date());

  // First: which players were referred by this member?
  const { data: refs } = await sb
    .from("players")
    .select("id")
    .eq("referred_by", referrerId);
  const guestIds = (refs ?? []).map((r) => r.id);
  if (guestIds.length === 0) return 0;

  const { count } = await sb
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("source", "referral")
    .eq("cap_consumed", true)
    .in("player_id", guestIds)
    .gte("created_at", from)
    .lt("created_at", to);

  return count ?? 0;
}

function monthRangeAmsterdamUtc(now: Date): { from: string; to: string } {
  // Use Intl to get the current Amsterdam year/month, then build first-of-month
  // and first-of-next-month as Amsterdam-local timestamps and convert to UTC.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);

  const fromAms = `${year}-${pad(month)}-01T00:00:00`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const toAms = `${nextYear}-${pad(nextMonth)}-01T00:00:00`;

  return { from: amsterdamToUtcIso(fromAms), to: amsterdamToUtcIso(toAms) };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Treats `local` as a wall-clock string in Europe/Amsterdam and returns the
// equivalent UTC ISO. Uses Intl to compute the current TZ offset, accounting
// for DST.
function amsterdamToUtcIso(localIso: string): string {
  // Parse as if UTC to get a Date object whose epoch is the literal wall-clock.
  const asUtc = new Date(localIso + "Z");
  // Determine Amsterdam offset at that moment.
  const offsetMinutes = amsterdamOffsetMinutes(asUtc);
  // Subtract offset to get the real UTC instant.
  return new Date(asUtc.getTime() - offsetMinutes * 60_000).toISOString();
}

function amsterdamOffsetMinutes(at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>(
    (acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    },
    {},
  );
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asIfUtc - at.getTime()) / 60_000;
}
