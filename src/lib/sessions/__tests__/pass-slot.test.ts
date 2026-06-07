/**
 * Tests for passSlot() business logic.
 *
 * Mock strategy: A Proxy-based chainable Supabase client where every fluent
 * chain method returns another Proxy sharing the same response queue.
 * Terminal operations (direct `await` or `.maybeSingle()`) pop the next
 * queued response.  Each test builds only as many queue entries as the code
 * path under test actually consumes.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { passSlot } from "../pass-slot";
import type { AttendanceRow, SessionRow } from "@/lib/db/types";

// ── Mock helpers ──────────────────────────────────────────────────────────────

type MockResponse = { data?: unknown; count?: number | null; error?: unknown };

/**
 * Build a mock Supabase client.  `responses` is consumed in order; each
 * terminal DB operation (await or .maybeSingle()) pops the next entry.
 */
function createMockSb(responses: MockResponse[]) {
  const queue = [...responses];

  function makeBuilder(): unknown {
    const handler: ProxyHandler<object> = {
      get(_, prop) {
        if (prop === "then") {
          return (
            onFulfilled?: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => {
            const result = queue.shift() ?? { data: null, error: null };
            return Promise.resolve(result).then(onFulfilled, onRejected);
          };
        }
        if (prop === "maybeSingle") {
          return () =>
            Promise.resolve(queue.shift() ?? { data: null, error: null });
        }
        // All other methods (select, eq, in, update, insert, …) chain.
        return (..._args: unknown[]) => makeBuilder();
      },
    };
    return new Proxy({}, handler);
  }

  return {
    from: (_table: string) => makeBuilder(),
  };
}

// ── Fixture factories ─────────────────────────────────────────────────────────

const PASSER_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const RECEIVER_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const SESSION_ID = "cccccccc-0000-0000-0000-000000000003";
const SEASON_ID = "dddddddd-0000-0000-0000-000000000004";

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

function makeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  return {
    id: SESSION_ID,
    season_id: SEASON_ID,
    capacity: 20,
    tikkie_url: null,
    location: "Sporthal Diemen",
    status: "scheduled",
    start_at: futureDate,
    end_at: null,
    cutoff_resolved_at: null,
    trial_quota: 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAttendance(overrides: Partial<AttendanceRow> = {}): AttendanceRow {
  return {
    id: "eeeeeeee-0000-0000-0000-000000000005",
    session_id: SESSION_ID,
    player_id: PASSER_ID,
    source: "subscription",
    rsvp_status: "in",
    payment_status: "assumed_paid",
    payment_due_at: null,
    marked_by: null,
    bunq_payment_id: null,
    is_tentative: false,
    bumped_at: null,
    cap_consumed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Build the full response queue for the happy-path code flow.
 *
 * @param receiverRow  existing attendance row for receiver (or null)
 * @param passerOverrides  overrides applied to the passer attendance row
 * @param subCount  how many subscription rows the receiver has this season
 */
function happyPathQueue({
  receiverRow = null,
  passerOverrides = {},
  subCount = 0,
}: {
  receiverRow?: Partial<AttendanceRow> | null;
  passerOverrides?: Partial<AttendanceRow>;
  subCount?: number;
} = {}): MockResponse[] {
  return [
    // 1. fetch session
    { data: makeSession() },
    // 2. fetch passer's attendance row
    { data: makeAttendance(passerOverrides) },
    // 3. fetch receiver player row
    { data: { id: RECEIVER_ID, status: "active" } },
    // 4. fetch season's session IDs
    { data: [{ id: SESSION_ID }] },
    // 5. count receiver's subscription rows for this season
    { count: subCount, data: null, error: null },
    // 6. fetch receiver's attendance row for this session
    {
      data: receiverRow != null ? makeAttendance({ player_id: RECEIVER_ID, ...receiverRow }) : null,
    },
    // 7. upsert receiver (update or insert) → no error
    { error: null },
    // 8. update passer → fire-and-forget
    { data: null, error: null },
    // 9. audit_log insert → fire-and-forget
    { data: null, error: null },
  ];
}

/**
 * Build a mock Supabase client that also captures every `.update(payload)`
 * call so tests can assert the exact state written back to the DB.
 *
 * `capturedUpdates` is populated in-place; pass an empty array to collect.
 */
function createCapturingMockSb(
  responses: MockResponse[],
  capturedUpdates: Array<{ table: string; payload: unknown }>,
) {
  const queue = [...responses];

  function makeBuilder(table: string): unknown {
    const handler: ProxyHandler<object> = {
      get(_, prop) {
        if (prop === "then") {
          return (
            onFulfilled?: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => {
            const result = queue.shift() ?? { data: null, error: null };
            return Promise.resolve(result).then(onFulfilled, onRejected);
          };
        }
        if (prop === "maybeSingle") {
          return () =>
            Promise.resolve(queue.shift() ?? { data: null, error: null });
        }
        if (prop === "update") {
          return (payload: unknown) => {
            capturedUpdates.push({ table, payload });
            return makeBuilder(table);
          };
        }
        return (..._args: unknown[]) => makeBuilder(table);
      },
    };
    return new Proxy({}, handler);
  }

  return { from: (t: string) => makeBuilder(t) };
}

describe("passSlot – happy paths", () => {
  beforeEach(() => {
    // Freeze Date.now so "session is in the past" checks pass consistently.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscriber passes to a new player E (no existing row – inserts)", async () => {
    const sb = createMockSb(happyPathQueue());
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: true });
  });

  it("paid drop-in passes to a new player E", async () => {
    const sb = createMockSb(
      happyPathQueue({ passerOverrides: { source: "drop_in", payment_status: "assumed_paid" } }),
    );
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: true });
  });

  it("subscriber passes to player D who is waitlisted (update existing row)", async () => {
    const sb = createMockSb(
      happyPathQueue({
        receiverRow: { rsvp_status: "waitlisted", payment_status: "unpaid" },
      }),
    );
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: true });
  });

  it("subscriber passes to E who has a previous cancelled row (update existing row)", async () => {
    const sb = createMockSb(
      happyPathQueue({
        receiverRow: { rsvp_status: "cancelled", payment_status: "unpaid" },
      }),
    );
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: true });
  });

  it("subscriber passes to E who previously opted out", async () => {
    const sb = createMockSb(
      happyPathQueue({
        receiverRow: { rsvp_status: "opted_out", payment_status: "assumed_paid" },
      }),
    );
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: true });
  });
});

// ── Error paths ───────────────────────────────────────────────────────────────

describe("passSlot – self-pass guard", () => {
  it("returns 400 when passerId === toPlayerId (no DB calls made)", async () => {
    const sb = createMockSb([]); // no responses needed
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: PASSER_ID,
    });
    expect(result).toEqual({ ok: false, error: "Cannot pass to yourself", status: 400 });
  });
});

describe("passSlot – session validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 404 when session not found", async () => {
    const sb = createMockSb([{ data: null }]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "Session not found", status: 404 });
  });

  it("returns 400 when session status is 'done'", async () => {
    const sb = createMockSb([{ data: makeSession({ status: "done" }) }]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "Session is not open", status: 400 });
  });

  it("returns 400 when session status is 'cancelled'", async () => {
    const sb = createMockSb([{ data: makeSession({ status: "cancelled" }) }]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "Session is not open", status: 400 });
  });

  it("returns 400 when session start_at is in the past", async () => {
    const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
    const sb = createMockSb([{ data: makeSession({ start_at: pastDate }) }]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "Session is in the past", status: 400 });
  });
});

describe("passSlot – passer validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 400 when passer has no attendance row", async () => {
    const sb = createMockSb([
      { data: makeSession() }, // session ok
      { data: null },          // no passer row
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "No active RSVP to pass", status: 400 });
  });

  it("returns 400 when passer rsvp_status is 'opted_out' (not 'in')", async () => {
    const sb = createMockSb([
      { data: makeSession() },
      { data: makeAttendance({ rsvp_status: "opted_out" }) },
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "No active RSVP to pass", status: 400 });
  });

  it("returns 400 when passer rsvp_status is 'cancelled'", async () => {
    const sb = createMockSb([
      { data: makeSession() },
      { data: makeAttendance({ rsvp_status: "cancelled" }) },
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "No active RSVP to pass", status: 400 });
  });

  it("returns 400 when passer rsvp_status is 'passed' (already transferred)", async () => {
    const sb = createMockSb([
      { data: makeSession() },
      { data: makeAttendance({ rsvp_status: "passed" }) },
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "No active RSVP to pass", status: 400 });
  });

  it("returns 400 when drop-in passer has unpaid status", async () => {
    const sb = createMockSb([
      { data: makeSession() },
      { data: makeAttendance({ source: "drop_in", payment_status: "unpaid" }) },
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({
      ok: false,
      error: "Mark your payment before passing the slot",
      status: 400,
    });
  });

  it("allows flagged drop-in to pass (flagged is not unpaid)", async () => {
    // 'flagged' means admin noted something but payment is not blocked —
    // the passer should still be allowed to transfer.
    const sb = createMockSb(
      happyPathQueue({ passerOverrides: { source: "drop_in", payment_status: "flagged" } }),
    );
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("passSlot – receiver validation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 400 when receiver player not found", async () => {
    const sb = createMockSb([
      { data: makeSession() },
      { data: makeAttendance() },
      { data: null }, // player not found
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "Recipient not found or inactive", status: 400 });
  });

  it("returns 400 when receiver is blocked/inactive", async () => {
    const sb = createMockSb([
      { data: makeSession() },
      { data: makeAttendance() },
      { data: { id: RECEIVER_ID, status: "blocked" } },
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "Recipient not found or inactive", status: 400 });
  });

  it("returns 400 when receiver already has a subscription this season", async () => {
    const sb = createMockSb([
      { data: makeSession() },
      { data: makeAttendance() },
      { data: { id: RECEIVER_ID, status: "active" } },
      { data: [{ id: SESSION_ID }] }, // season sessions
      { count: 1, data: null },        // 1 subscription row → blocked
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({
      ok: false,
      error: "Recipient already has a subscription this season",
      status: 400,
    });
  });

  it("returns 400 when receiver B (referral, tentative) already has rsvp_status='in'", async () => {
    // Player B referred pre-cutoff: rsvp_status='in', is_tentative=true.
    // They already hold a seat; passing to them is blocked.
    const sb = createMockSb([
      { data: makeSession() },
      { data: makeAttendance() },
      { data: { id: RECEIVER_ID, status: "active" } },
      { data: [{ id: SESSION_ID }] },
      { count: 0, data: null },
      // receiver row: already 'in'
      {
        data: makeAttendance({
          player_id: RECEIVER_ID,
          source: "referral",
          rsvp_status: "in",
          is_tentative: true,
        }),
      },
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({
      ok: false,
      error: "Recipient already has an active RSVP",
      status: 400,
    });
  });

  it("returns 400 when receiver already has a confirmed 'in' drop-in RSVP", async () => {
    const sb = createMockSb([
      { data: makeSession() },
      { data: makeAttendance() },
      { data: { id: RECEIVER_ID, status: "active" } },
      { data: [{ id: SESSION_ID }] },
      { count: 0, data: null },
      {
        data: makeAttendance({
          player_id: RECEIVER_ID,
          source: "drop_in",
          rsvp_status: "in",
          payment_status: "assumed_paid",
        }),
      },
    ]);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({
      ok: false,
      error: "Recipient already has an active RSVP",
      status: 400,
    });
  });
});

describe("passSlot – DB write failures", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 500 when insert for new receiver fails", async () => {
    const responses: MockResponse[] = [
      { data: makeSession() },
      { data: makeAttendance() },
      { data: { id: RECEIVER_ID, status: "active" } },
      { data: [{ id: SESSION_ID }] },
      { count: 0, data: null },
      { data: null }, // no existing receiver row → will insert
      { error: { message: "db error" } }, // insert fails
    ];
    const sb = createMockSb(responses);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "Could not pass slot", status: 500 });
  });

  it("returns 500 when update for existing receiver row fails", async () => {
    const responses: MockResponse[] = [
      { data: makeSession() },
      { data: makeAttendance() },
      { data: { id: RECEIVER_ID, status: "active" } },
      { data: [{ id: SESSION_ID }] },
      { count: 0, data: null },
      // receiver has a cancelled row
      {
        data: makeAttendance({
          player_id: RECEIVER_ID,
          rsvp_status: "cancelled",
        }),
      },
      { error: { message: "db error" } }, // update fails
    ];
    const sb = createMockSb(responses);
    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });
    expect(result).toEqual({ ok: false, error: "Could not pass slot", status: 500 });
  });
});

describe("passSlot – passer outcome after successful transfer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ["subscription", { source: "subscription" } as Partial<AttendanceRow>],
    ["drop_in (paid)", { source: "drop_in", payment_status: "assumed_paid" } as Partial<AttendanceRow>],
  ])("%s passer gets rsvp_status='passed' — permanent, cannot reclaim", async (_label, passerOverrides) => {
    const updates: Array<{ table: string; payload: unknown }> = [];
    const sb = createCapturingMockSb(happyPathQueue({ passerOverrides }), updates);

    const result = await passSlot({
      sb: sb as never,
      passerId: PASSER_ID,
      sessionId: SESSION_ID,
      toPlayerId: RECEIVER_ID,
    });

    expect(result).toEqual({ ok: true });

    const passerUpdate = updates.find(
      (u) =>
        u.table === "attendance" &&
        (u.payload as { rsvp_status?: string }).rsvp_status === "passed",
    );
    expect(passerUpdate).toBeDefined();
  });
});
