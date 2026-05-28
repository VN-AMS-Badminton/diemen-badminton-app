// Locale-aware formatters for Europe/Amsterdam display.

const TZ = "Europe/Amsterdam";

export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "long",
    timeZone: TZ,
  }).format(d);
}

export function formatDateShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeZone: TZ,
  }).format(d);
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: TZ,
  }).format(d);
}

export function formatWeekday(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    timeZone: TZ,
  }).format(d);
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

// Render a player as "Display Name (username)" when display_name is present,
// otherwise just the username. Admin views use this so they can match a
// Tikkie payment against either field.
export function playerLabel(p: {
  username: string;
  display_name?: string | null;
}): string {
  const dn = p.display_name?.trim();
  return dn ? `${dn} (${p.username})` : p.username;
}
