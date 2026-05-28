import type { SupabaseClient } from "@supabase/supabase-js";
import { toAmsterdamTimestamp } from "@/lib/amsterdam-time-utils";

// Plan + apply the cascade of a season edit onto its child sessions.
//
// Rules (locked in plan 260527-2226-github-issues-4-5-7 phase 3):
//   * Only `scheduled` sessions are touched. `done` and `cancelled` are inert.
//   * Schedule fields (weekday, start_time, end_time, from_date, to_date)
//     recompute `start_at` / `end_at` for sessions whose date still falls in
//     the new range AND matches the new weekday.
//   * Sessions whose date falls outside the new range OR no longer matches
//     the new weekday are returned as `stranded` — the API surface decides
//     whether to auto-cancel them or ask admin first.
//   * Other safe fields (location, capacity, fees, tikkie_url_override)
//     propagate to every scheduled session.

export interface SeasonScheduleSlice {
  weekday: number;
  start_time: string;
  end_time: string;
  from_date: string; // YYYY-MM-DD
  to_date: string;   // YYYY-MM-DD
  location: string;
  capacity: number;  // derived from court_count * 6
  tikkie_url_override: string | null;
}

export interface SessionForCascade {
  id: string;
  start_at: string; // UTC ISO
  status: "scheduled" | "done" | "cancelled";
}

export interface CascadeStrandedSession {
  id: string;
  date: string; // local YYYY-MM-DD
  reason: "out_of_range" | "weekday_mismatch";
}

export interface CascadePlan {
  toUpdate: Array<{
    id: string;
    patch: {
      start_at: string;
      end_at: string;
      location: string;
      capacity: number;
      tikkie_url: string | null;
    };
  }>;
  stranded: CascadeStrandedSession[];
}

const TZ = "Europe/Amsterdam";

function localDateFromUtc(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: TZ });
}

function utcDayFromLocalDate(date: string): number {
  // Compute weekday of the local date.  Date arithmetic in UTC stays consistent
  // because we only care about the day-of-week of the local calendar date.
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function planCascade(
  next: SeasonScheduleSlice,
  sessions: SessionForCascade[],
): CascadePlan {
  const toUpdate: CascadePlan["toUpdate"] = [];
  const stranded: CascadeStrandedSession[] = [];

  for (const s of sessions) {
    if (s.status !== "scheduled") continue;
    const date = localDateFromUtc(s.start_at);

    if (date < next.from_date || date > next.to_date) {
      stranded.push({ id: s.id, date, reason: "out_of_range" });
      continue;
    }
    if (utcDayFromLocalDate(date) !== next.weekday) {
      stranded.push({ id: s.id, date, reason: "weekday_mismatch" });
      continue;
    }

    toUpdate.push({
      id: s.id,
      patch: {
        start_at: toAmsterdamTimestamp(date, next.start_time),
        end_at: toAmsterdamTimestamp(date, next.end_time),
        location: next.location,
        capacity: next.capacity,
        // Cascading tikkie_url is intentional: the session-level override is
        // null when there's no per-session deviation, so admin's season-level
        // override propagates to all children.
        tikkie_url: next.tikkie_url_override,
      },
    });
  }

  return { toUpdate, stranded };
}

export async function applyCascade(
  sb: SupabaseClient,
  plan: CascadePlan,
): Promise<{ updated: number }> {
  let updated = 0;
  for (const u of plan.toUpdate) {
    const { error } = await sb.from("sessions").update(u.patch).eq("id", u.id);
    if (error) throw error;
    updated += 1;
  }
  return { updated };
}
