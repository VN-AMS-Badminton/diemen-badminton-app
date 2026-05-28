// Pure helper: enumerate every YYYY-MM-DD between `from` and `to` (inclusive)
// whose weekday matches `weekday` (0=Sunday … 6=Saturday).
//
// Used by season auto-generation to figure out which dates need a session.
// Treats the input dates as calendar dates in UTC for arithmetic — caller is
// responsible for any timezone interpretation. This is safe because weekday
// computation only depends on the calendar date, not the time of day.

const ONE_DAY_MS = 86_400_000;

export function enumerateWeekdayDates(
  fromDate: string,
  toDate: string,
  weekday: number,
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return [];
  }
  if (weekday < 0 || weekday > 6 || !Number.isInteger(weekday)) {
    return [];
  }

  const start = Date.UTC(
    Number(fromDate.slice(0, 4)),
    Number(fromDate.slice(5, 7)) - 1,
    Number(fromDate.slice(8, 10)),
  );
  const end = Date.UTC(
    Number(toDate.slice(0, 4)),
    Number(toDate.slice(5, 7)) - 1,
    Number(toDate.slice(8, 10)),
  );
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return [];
  }

  const dates: string[] = [];
  for (let ts = start; ts <= end; ts += ONE_DAY_MS) {
    const d = new Date(ts);
    if (d.getUTCDay() === weekday) {
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      dates.push(iso);
    }
  }
  return dates;
}
