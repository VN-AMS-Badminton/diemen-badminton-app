// Payment provider selection. The app supports a single active provider at a
// time, chosen via the PAYMENT_PROVIDER env flag. This lets bunq run in parallel
// with the legacy Tikkie flow and roll back with a single env change.
//
// The per-session / per-season override URL columns (sessions.tikkie_url,
// seasons.tikkie_url_override) are reused as generic payment-link overrides —
// admin pastes whichever provider's link is active. A future cleanup migration
// renames those columns once Tikkie is fully retired.

export type PaymentProvider = "tikkie" | "bunq";

/** Active payment provider. Defaults to `tikkie` when unset/unknown. */
export function getActiveProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER === "bunq" ? "bunq" : "tikkie";
}

/** Human-facing label used in player-facing copy and buttons. */
export function providerLabel(provider: PaymentProvider): string {
  return provider === "bunq" ? "bunq" : "Tikkie";
}

/** Env-configured default payment link for the given provider. */
export function providerDefaultUrl(provider: PaymentProvider): string {
  const url =
    provider === "bunq"
      ? process.env.BUNQ_DEFAULT_URL
      : process.env.TIKKIE_DEFAULT_URL;
  return url ?? "";
}
