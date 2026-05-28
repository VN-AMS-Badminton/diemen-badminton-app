import type { SupabaseClient } from "@supabase/supabase-js";
import { toAmsterdamTimestamp } from "@/lib/amsterdam-time-utils";
import { enumerateWeekdayDates } from "./enumerate-weekday-dates";

// The server client in `lib/supabase/server.ts` is created without a Database
// generic, so callers pass an untyped SupabaseClient here on purpose.

// Auto-generate scheduled sessions for a freshly-created season.
// One session per matching weekday between [from_date, to_date].
// Idempotent: relies on the functional unique index
// `sessions_season_local_date_key` to skip dates that already exist.

interface SeasonInput {
  id: string;
  from_date: string;
  to_date: string;
  weekday: number;
  start_time: string;
  end_time: string;
  location: string;
  // Capacity per session. Caller computes from court_count × 6 (6 players/court
  // default) so callers without a season can override.
  capacity: number;
}

export interface GenerateResult {
  created: number;
  skipped: number;
  dates: string[];
}

export async function generateSessionsForSeason(
  sb: SupabaseClient,
  season: SeasonInput,
): Promise<GenerateResult> {
  const dates = enumerateWeekdayDates(
    season.from_date,
    season.to_date,
    season.weekday,
  );
  if (dates.length === 0) {
    return { created: 0, skipped: 0, dates: [] };
  }

  const rows = dates.map((date) => ({
    season_id: season.id,
    start_at: toAmsterdamTimestamp(date, season.start_time),
    end_at: toAmsterdamTimestamp(date, season.end_time),
    location: season.location,
    capacity: season.capacity,
    status: "scheduled" as const,
    tikkie_url: null,
  }));

  let created = 0;
  let skipped = 0;
  // Insert one at a time so a single conflicting date can be skipped without
  // aborting the whole batch. Volume is bounded (<= 366 sessions per year).
  for (const row of rows) {
    const { error } = await sb.from("sessions").insert(row);
    if (error) {
      const isConflict =
        error.code === "23505" ||
        error.message?.toLowerCase().includes("duplicate");
      if (isConflict) {
        skipped += 1;
        continue;
      }
      throw error;
    }
    created += 1;
  }

  return { created, skipped, dates };
}
