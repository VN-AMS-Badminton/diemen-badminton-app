import type { SeasonRow, SessionRow } from "@/lib/db/types";
import {
  getActiveProvider,
  providerDefaultUrl,
  providerLabel,
  type PaymentProvider,
} from "@/lib/payments/provider";

export interface PaymentContext {
  /** Provider-agnostic payment link the player taps to pay. */
  payUrl: string;
  /** Active payment provider (tikkie | bunq). */
  provider: PaymentProvider;
  /** Human-facing provider label for UI copy/buttons. */
  providerLabel: string;
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
  const provider = getActiveProvider();
  const fallback = providerDefaultUrl(provider);
  // Lookup chain (reused override columns): drop-ins take the session-level url
  // first; subscriptions skip to the season-level override; both fall back to
  // the active provider's env default.
  const payUrl =
    (args.scope === "drop_in" ? args.session?.tikkie_url : null) ??
    args.season.tikkie_url_override ??
    fallback;
  const amountCents =
    args.scope === "subscription"
      ? args.season.subscription_fee_per_session_cents * (args.sessionCount ?? 1)
      : args.season.drop_in_fee_per_session_cents;
  return {
    payUrl,
    provider,
    providerLabel: providerLabel(provider),
    amountCents,
    scope: args.scope,
    username: args.username,
  };
}

export function formatEuros(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
