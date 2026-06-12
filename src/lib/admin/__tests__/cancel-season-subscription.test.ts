/**
 * Tests for cancelSeasonSubscription() business logic.
 *
 * DB mocked via the shared chainable Proxy client; writeAudit and
 * promoteWaitlist are module-mocked.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttendanceRow } from "@/lib/db/types";
import { createMockSb, callsOf } from "./chainable-mock-sb";

vi.mock("@/lib/admin/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/waitlist/promote-waitlist", () => ({
  promoteWaitlist: vi.fn().mockResolvedValue({ ok: true, promotedIds: [] }),
}));

import { writeAudit } from "@/lib/admin/audit";
import { promoteWaitlist } from "@/lib/waitlist/promote-waitlist";
import { cancelSeasonSubscription } from "../cancel-season-subscription";

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PLAYER_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const SEASON_ID = "ffffffff-0000-0000-0000-000000000006";
const SESSION_1 = "cccccccc-0000-0000-0000-000000000003";
const SESSION_2 = "cccccccc-0000-0000-0000-000000000007";

function makeRow(overrides: Partial<AttendanceRow> = {}): AttendanceRow {
  return {
    id: "dddddddd-0000-0000-0000-000000000004",
    session_id: SESSION_1,
    player_id: PLAYER_ID,
    source: "subscription",
    rsvp_status: "in",
    payment_status: "assumed_paid",
    payment_due_at: null,
    marked_by: null,
    bunq_payment_id: null,
    is_tentative: false,
    bumped_at: null,
    cap_consumed: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("cancelSeasonSubscription", () => {
  it("cancels future rows, marks paid ones refund_pending, promotes freed sessions", async () => {
    const inRow = makeRow({ id: "dddddddd-0000-0000-0000-000000000010" });
    const optedOutRow = makeRow({
      id: "dddddddd-0000-0000-0000-000000000011",
      session_id: SESSION_2,
      rsvp_status: "opted_out",
      payment_status: "flagged",
    });
    const { sb, calls } = createMockSb([
      { data: { id: SEASON_ID } },
      { data: [{ id: SESSION_1 }, { id: SESSION_2 }] },
      { data: [inRow, optedOutRow] },
      { data: null, error: null }, // bulk cancel update
      { data: null, error: null }, // refund_pending update
    ]);

    const result = await cancelSeasonSubscription({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      seasonId: SEASON_ID,
      playerId: PLAYER_ID,
      reason: "moving abroad",
    });

    expect(result).toEqual({ ok: true, cancelledCount: 2 });

    const updates = callsOf(calls, "update");
    expect(updates[0]?.args[0]).toEqual({
      rsvp_status: "cancelled",
      marked_by: ADMIN_ID,
    });
    expect(updates[1]?.args[0]).toEqual({ payment_status: "refund_pending" });

    // Only the 'in' row freed a seat; the opted_out one held none.
    expect(promoteWaitlist).toHaveBeenCalledTimes(1);
    expect(promoteWaitlist).toHaveBeenCalledWith(SESSION_1);

    expect(writeAudit).toHaveBeenCalledWith(
      ADMIN_ID,
      "admin_cancel_season_subscription",
      "season",
      SEASON_ID,
      null,
      expect.objectContaining({
        player_id: PLAYER_ID,
        cancelled_attendance_ids: [inRow.id, optedOutRow.id],
        refund_pending_attendance_ids: [inRow.id],
        reason: "moving abroad",
      }),
      sb,
    );
  });

  it("returns 0 when the season has no future scheduled sessions", async () => {
    const { sb, calls } = createMockSb([
      { data: { id: SEASON_ID } },
      { data: [] },
    ]);

    const result = await cancelSeasonSubscription({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      seasonId: SEASON_ID,
      playerId: PLAYER_ID,
    });

    expect(result).toEqual({ ok: true, cancelledCount: 0 });
    expect(callsOf(calls, "update")).toHaveLength(0);
    expect(writeAudit).not.toHaveBeenCalled();
    expect(promoteWaitlist).not.toHaveBeenCalled();
  });

  it("returns 0 when the player has no active subscription rows", async () => {
    const { sb, calls } = createMockSb([
      { data: { id: SEASON_ID } },
      { data: [{ id: SESSION_1 }] },
      { data: [] },
    ]);

    const result = await cancelSeasonSubscription({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      seasonId: SEASON_ID,
      playerId: PLAYER_ID,
    });

    expect(result).toEqual({ ok: true, cancelledCount: 0 });
    expect(callsOf(calls, "update")).toHaveLength(0);
  });

  it("skips the refund update when nothing was assumed_paid", async () => {
    const unpaidRow = makeRow({ payment_status: "unpaid" });
    const { sb, calls } = createMockSb([
      { data: { id: SEASON_ID } },
      { data: [{ id: SESSION_1 }] },
      { data: [unpaidRow] },
      { data: null, error: null }, // bulk cancel update
    ]);

    const result = await cancelSeasonSubscription({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      seasonId: SEASON_ID,
      playerId: PLAYER_ID,
    });

    expect(result).toEqual({ ok: true, cancelledCount: 1 });
    expect(callsOf(calls, "update")).toHaveLength(1);
  });

  it("returns 404 for a missing season", async () => {
    const { sb } = createMockSb([{ data: null }]);

    const result = await cancelSeasonSubscription({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      seasonId: SEASON_ID,
      playerId: PLAYER_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: "Season not found",
      status: 404,
    });
  });
});
