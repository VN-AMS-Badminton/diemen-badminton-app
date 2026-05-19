// Drop-in payment deadline math.
//
// A drop-in RSVP must be self-confirmed paid within 36h or it's auto-dropped.
// Cap the deadline at the session's actual start so a last-minute RSVP can't
// outlive the session it belongs to.

export const PAYMENT_WINDOW_HOURS = 36;

const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_HOURS * 60 * 60 * 1000;

export function computePaymentDeadline(sessionStartAt: string): string {
  const sessionStartMs = new Date(sessionStartAt).getTime();
  const windowMs = Date.now() + PAYMENT_WINDOW_MS;
  return new Date(Math.min(windowMs, sessionStartMs)).toISOString();
}
