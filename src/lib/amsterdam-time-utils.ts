// Amsterdam timezone conversion helpers. All functions treat Europe/Amsterdam
// as the local timezone (CET winter / CEST summer — DST handled by Intl API).

const TZ = "Europe/Amsterdam";

// Converts a calendar date ("YYYY-MM-DD") and 24h time ("HH:MM") in Amsterdam
// local time to a UTC ISO-8601 string.
// Strategy: sample the Amsterdam UTC offset at noon on that date (noon is
// safely away from DST transitions, which occur at 2 AM local time).
export function toAmsterdamTimestamp(date: string, time: string): string {
  const [hh, mm] = time.split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  const noonUtc = new Date(`${date}T12:00:00Z`);
  const amNoonHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
    }).format(noonUtc),
  );
  // amNoonHour − 12 = how many hours Amsterdam is ahead of UTC at that date.
  const offsetMs = (amNoonHour - 12) * 3_600_000;
  return new Date(Date.UTC(y, mo - 1, d, hh, mm) - offsetMs).toISOString();
}

// Returns "YYYY-MM-DD" for a UTC ISO timestamp, interpreted in Amsterdam TZ.
export function localDateFromStartAt(startAt: string): string {
  return new Date(startAt).toLocaleDateString("sv-SE", { timeZone: TZ });
}

// Returns the UTC ISO string for midnight (00:00) today in Amsterdam TZ.
// Use for Supabase filters that should include today even if the session has
// already started (e.g. admin "upcoming" views).
export function startOfTodayAmsterdamUtc(): string {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
  return toAmsterdamTimestamp(today, "00:00");
}
