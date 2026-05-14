import type { SeasonRow, SessionRow } from "@/lib/db/types";

export interface PaymentContext {
  tikkieUrl: string;
  amountCents: number;
  scope: "subscription" | "drop_in";
  username: string;
}

export function getPaymentContext(args: {
  season: SeasonRow;
  session?: Pick<SessionRow, "tikkie_url"> | null;
  scope: "subscription" | "drop_in";
  username: string;
  /** Number of scheduled sessions in the season — used to compute subscription total. */
  sessionCount?: number;
}): PaymentContext {
  const fallback = process.env.TIKKIE_DEFAULT_URL ?? "";
  // Drop-ins: session-level url first; subscriptions skip to season-level.
  const tikkieUrl =
    (args.scope === "drop_in" ? args.session?.tikkie_url : null) ??
    args.season.tikkie_url_override ??
    fallback;
  const amountCents =
    args.scope === "subscription"
      ? args.season.subscription_fee_per_session_cents * (args.sessionCount ?? 1)
      : args.season.drop_in_fee_per_session_cents;
  return { tikkieUrl, amountCents, scope: args.scope, username: args.username };
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
