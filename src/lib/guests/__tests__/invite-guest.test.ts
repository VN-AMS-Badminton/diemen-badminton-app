/**
 * Tests for inviteGuest() business logic.
 *
 * Mock strategy: vi.mock replaces createServerSupabase with a factory that
 * returns a Proxy-based chainable client consuming a queued response array.
 * Awaiting the builder (via the "then" trap) pops the next entry.
 * writeAudit is mocked as a no-op throughout.
 *
 * The entire invite is a single RPC call (invite_guest_trial). Each test
 * needs exactly one queue entry — the jsonb the DB function would return.
 *
 * Queue entry shape:
 *   happy path: { data: { ok: true, playerId, attendanceId }, error: null }
 *   guard fail: { data: { ok: false, error: "..." }, error: null }
 *   RPC error:  { data: null, error: { message: "..." } }
 *
 * Session validation (status, start_at, quota, capacity) now runs inside the
 * DB function, so no fake timers or session fixtures are needed here.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: vi.fn() }));
vi.mock("@/lib/admin/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));

import { inviteGuest } from "../invite-guest";
import { createServerSupabase } from "@/lib/supabase/server";

// ── Mock helpers ──────────────────────────────────────────────────────────────

type MockResponse = { data?: unknown; error?: unknown };

/**
 * Build a mock Supabase client. `responses` is consumed in order; each
 * terminal DB operation (await via the "then" trap or .maybeSingle()) pops
 * the next entry.
 */
function createMockSb(responses: MockResponse[]) {
  const queue = [...responses];

  function makeBuilder(): unknown {
    return new Proxy({}, {
      get(_, prop) {
        if (prop === "then") {
          return (
            onFulfilled?: (v: unknown) => unknown,
            onRejected?: (r: unknown) => unknown,
          ) =>
            Promise.resolve(queue.shift() ?? { data: null, error: null }).then(
              onFulfilled,
              onRejected,
            );
        }
        if (prop === "maybeSingle") {
          return () =>
            Promise.resolve(queue.shift() ?? { data: null, error: null });
        }
        return () => makeBuilder();
      },
    });
  }

  return {
    from: (_table: string) => makeBuilder(),
    rpc:  (_func: string, _params: unknown) => makeBuilder(),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SESSION_ID  = "aaaaaaaa-0000-0000-0000-000000000001";
const REFERRER_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const PLAYER_ID   = "cccccccc-0000-0000-0000-000000000003";

const BASE_PARAMS = {
  sessionId:  SESSION_ID,
  referrerId: REFERRER_ID,
  guestName:  "John Doe",
  guestPhone: "+31612345678",
};

// ── Phone validation ──────────────────────────────────────────────────────────

describe("inviteGuest – phone validation", () => {
  it("rejects a phone with fewer than 7 digits (e.g. 4 digits)", async () => {
    const sb = createMockSb([]); // no DB calls expected
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest({ ...BASE_PARAMS, guestPhone: "1234" });

    expect(result).toEqual({
      ok: false,
      error: "Enter a valid phone number (at least 7 digits)",
    });
  });
});

// ── Session guards ────────────────────────────────────────────────────────────

describe("inviteGuest – session guards", () => {
  it("returns session not found when the RPC reports it", async () => {
    const sb = createMockSb([
      { data: { ok: false, error: "Session not found" }, error: null },
    ]);
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest(BASE_PARAMS);

    expect(result).toEqual({ ok: false, error: "Session not found" });
  });

  it("rejects when session status is not 'scheduled'", async () => {
    const sb = createMockSb([
      { data: { ok: false, error: "Session is no longer open" }, error: null },
    ]);
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest(BASE_PARAMS);

    expect(result).toEqual({ ok: false, error: "Session is no longer open" });
  });

  it("rejects when session start_at is in the past", async () => {
    const sb = createMockSb([
      { data: { ok: false, error: "Session has already passed" }, error: null },
    ]);
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest(BASE_PARAMS);

    expect(result).toEqual({ ok: false, error: "Session has already passed" });
  });
});

// ── Trial quota guard ─────────────────────────────────────────────────────────

describe("inviteGuest – trial quota guard", () => {
  it("rejects when trial slots are exhausted (trialUsed >= trial_quota)", async () => {
    const sb = createMockSb([
      {
        data: { ok: false, error: "All trial slots for this session are taken" },
        error: null,
      },
    ]);
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest(BASE_PARAMS);

    expect(result).toEqual({
      ok: false,
      error: "All trial slots for this session are taken",
    });
  });
});

// ── Capacity guard ────────────────────────────────────────────────────────────

describe("inviteGuest – capacity guard", () => {
  it("rejects when session is at full capacity (inCount >= capacity)", async () => {
    const sb = createMockSb([
      { data: { ok: false, error: "Session is full" }, error: null },
    ]);
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest(BASE_PARAMS);

    expect(result).toEqual({ ok: false, error: "Session is full" });
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe("inviteGuest – happy path", () => {
  it("returns { ok: true, guestName } when all guards pass", async () => {
    const sb = createMockSb([
      {
        data: { ok: true, playerId: PLAYER_ID, attendanceId: "att-001" },
        error: null,
      },
    ]);
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest(BASE_PARAMS);

    expect(result).toEqual({ ok: true, guestName: "John Doe" });
  });
});

// ── DB failure paths ──────────────────────────────────────────────────────────

describe("inviteGuest – DB failure paths", () => {
  it("returns dedup error when the RPC reports phone already used for a trial", async () => {
    const sb = createMockSb([
      {
        data: {
          ok: false,
          error: "This phone number has already been used for a free trial",
        },
        error: null,
      },
    ]);
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest(BASE_PARAMS);

    expect(result).toEqual({
      ok: false,
      error: "This phone number has already been used for a free trial",
    });
  });

  it("returns RSVP error when the attendance insert fails inside the RPC", async () => {
    const sb = createMockSb([
      {
        data: { ok: false, error: "Could not RSVP guest to session" },
        error: null,
      },
    ]);
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest(BASE_PARAMS);

    expect(result).toEqual({ ok: false, error: "Could not RSVP guest to session" });
  });

  it("returns generic error when the RPC call itself fails at the Supabase level", async () => {
    const sb = createMockSb([
      { data: null, error: { message: "connection refused" } },
    ]);
    vi.mocked(createServerSupabase).mockReturnValue(sb as never);

    const result = await inviteGuest(BASE_PARAMS);

    expect(result).toEqual({ ok: false, error: "Could not register guest" });
  });
});
