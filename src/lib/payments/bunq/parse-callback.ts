// Parse a bunq callback body into a normalized payment shape.
//
// bunq wraps callbacks as:
//   { "NotificationUrl": { category, event_type, object: { Payment: {...} } } }
// The inner object key varies (Payment / Mutation / MasterCardAction …); we
// take the first object value and read the fields common to incoming payments.
// Exact schema is only fully knowable from sandbox payloads, so this is written
// defensively and returns null when it can't find a usable payment.

export interface ParsedPayment {
  /** bunq payment/mutation id, stringified for storage in bunq_payment_id. */
  paymentId: string;
  /** Signed amount in cents (positive = incoming). */
  amountCents: number;
  currency: string;
  /** Free-text description the payer entered (where the player name lives). */
  description: string;
  /** ISO timestamp if present. */
  created: string | null;
}

function readAmountCents(amount: unknown): number | null {
  if (!amount || typeof amount !== "object") return null;
  const value = (amount as { value?: unknown }).value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Pull the inner payment object out of bunq's nested wrapper (or a flat body). */
function extractPaymentObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const notif =
    (root.NotificationUrl as Record<string, unknown> | undefined) ?? root;
  const object =
    (notif.object as Record<string, unknown> | undefined) ?? notif;
  // object is like { Payment: {...} } — take the first object-valued entry,
  // or treat `object` itself as the payment if it already has an amount.
  if (object && typeof object === "object") {
    if ("amount" in object) return object;
    for (const v of Object.values(object)) {
      if (v && typeof v === "object" && "amount" in (v as object)) {
        return v as Record<string, unknown>;
      }
    }
  }
  return null;
}

export function parseBunqCallback(body: unknown): ParsedPayment | null {
  const p = extractPaymentObject(body);
  if (!p) return null;
  const amountCents = readAmountCents(p.amount);
  const id = p.id;
  if (amountCents == null || id == null) return null;
  return {
    paymentId: String(id),
    amountCents,
    currency:
      ((p.amount as { currency?: string } | undefined)?.currency) ?? "EUR",
    description: typeof p.description === "string" ? p.description : "",
    created: typeof p.created === "string" ? p.created : null,
  };
}
