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

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
