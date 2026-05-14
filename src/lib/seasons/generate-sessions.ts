// Pure function: given a year-month and a weekday (1=Mon..7=Sun), return
// the dates for every occurrence of that weekday in that month, as ISO date
// strings (YYYY-MM-DD). Computed in Europe/Amsterdam local calendar — the
// `date` column is stored as a calendar date, so timezone math is only about
// picking the right Y/M/D.

export interface GeneratedSession {
  date: string; // 'YYYY-MM-DD'
  weekday_time: string; // 'Thu 19:00'
}

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function generateSessions(args: {
  yearMonth: string; // '2026-05'
  weekday: number; // 0=Sun..6=Sat (matches JS Date.getDay)
  time: string; // '19:00'
}): GeneratedSession[] {
  const [yStr, mStr] = args.yearMonth.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10); // 1-based
  if (!y || !m || m < 1 || m > 12)
    throw new Error(`Invalid year_month: ${args.yearMonth}`);

  const out: GeneratedSession[] = [];
  // Iterate days of the month.
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(Date.UTC(y, m - 1, d));
    if (day.getUTCDay() === args.weekday) {
      const iso = `${yStr}-${mStr.padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({
        date: iso,
        weekday_time: `${WEEKDAY_LABEL[args.weekday]} ${args.time}`,
      });
    }
  }
  return out;
}
