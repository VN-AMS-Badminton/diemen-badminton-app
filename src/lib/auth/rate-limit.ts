// Simple in-memory rate limiter keyed by username.
// Single-region Vercel only. For multi-region, swap to Upstash Redis.

interface Entry {
  count: number;
  lockedUntil: number;
}

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const attempts = new Map<string, Entry>();

export function checkRateLimit(key: string): {
  allowed: boolean;
  retryAfterMs: number;
} {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) return { allowed: true, retryAfterMs: 0 };
  if (entry.lockedUntil > now) {
    return { allowed: false, retryAfterMs: entry.lockedUntil - now };
  }
  // Lockout expired → reset
  if (entry.lockedUntil !== 0 && entry.lockedUntil <= now) {
    attempts.delete(key);
  }
  return { allowed: true, retryAfterMs: 0 };
}

export function recordFailure(key: string): {
  lockedOut: boolean;
  attemptsRemaining: number;
} {
  const now = Date.now();
  const entry = attempts.get(key) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    attempts.set(key, entry);
    return { lockedOut: true, attemptsRemaining: 0 };
  }
  attempts.set(key, entry);
  return {
    lockedOut: false,
    attemptsRemaining: MAX_ATTEMPTS - entry.count,
  };
}

export function recordSuccess(key: string): void {
  attempts.delete(key);
}

export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

export function normalizePhone(p: string): string {
  return p.replace(/[^\d+]/g, "");
}
