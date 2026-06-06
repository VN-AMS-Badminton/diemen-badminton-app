// Pure payment-matching logic. No I/O — easy to unit test exhaustively.
//
// Two independent decisions:
//   1. WHO paid — match the payment description against player username /
//      display name. High confidence only when EXACTLY ONE player matches.
//   2. WHAT for — infer scope from the amount: drop-in fee vs subscription
//      total. Anything else is "unknown".
//
// We deliberately use exact substring matching (normalized) rather than fuzzy
// Levenshtein: at this scale false positives are worse than a manual fallback.
// Auto-actions downstream require BOTH high confidence AND a known scope.

export interface MatchablePlayer {
  id: string;
  username: string;
  display_name: string | null;
}

export type MatchScope = "drop_in" | "subscription" | "unknown";

export interface MatchResult {
  player: MatchablePlayer | null;
  confidence: "high" | "none";
  scope: MatchScope;
}

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics
    .replace(/\s+/g, " ")
    .trim();
}

/** True when any whitespace-delimited token of `name` appears in `haystack`. */
function nameMatches(haystack: string, name: string | null): boolean {
  if (!name) return false;
  const norm = normalize(name);
  if (!norm) return false;
  // Whole normalized name as a substring is the primary signal.
  if (haystack.includes(norm)) return true;
  // Username is usually a single token; require the full token (>=3 chars) to
  // avoid matching trivially short fragments.
  return norm.length >= 3 && new RegExp(`\\b${escapeRegExp(norm)}\\b`).test(haystack);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function inferScope(
  amountCents: number,
  dropInFeeCents: number,
  subscriptionTotalCents: number,
): MatchScope {
  if (amountCents === dropInFeeCents) return "drop_in";
  if (amountCents === subscriptionTotalCents) return "subscription";
  return "unknown";
}

export function matchPayment(input: {
  description: string;
  amountCents: number;
  players: MatchablePlayer[];
  dropInFeeCents: number;
  subscriptionTotalCents: number;
}): MatchResult {
  const haystack = normalize(input.description);
  const hits = input.players.filter(
    (p) => nameMatches(haystack, p.username) || nameMatches(haystack, p.display_name),
  );
  const scope = inferScope(
    input.amountCents,
    input.dropInFeeCents,
    input.subscriptionTotalCents,
  );
  if (hits.length === 1) {
    return { player: hits[0], confidence: "high", scope };
  }
  return { player: null, confidence: "none", scope };
}
