/**
 * Tests for cancelBooking() business logic.
 *
 * DB mocked via the shared chainable Proxy client; writeAudit and
 * promoteWaitlist are module-mocked so we can assert they were (not) called.
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
import {
  cancelBooking,
  nextPaymentStatusOnCancel,
} from "../cancel-booking";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ADMIN_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const PLAYER_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const SESSION_ID = "cccccccc-0000-0000-0000-000000000003";
const ATT_ID = "dddddddd-0000-0000-0000-000000000004";
const REFERRER_ID = "eeeeeeee-0000-0000-0000-000000000005";

function makeAttendance(overrides: Partial<AttendanceRow> = {}): AttendanceRow {
  return {
    id: ATT_ID,
    session_id: SESSION_ID,
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

function futureSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    status: "scheduled",
    start_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── nextPaymentStatusOnCancel ─────────────────────────────────────────────────

describe("nextPaymentStatusOnCancel", () => {
  it("moves assumed_paid to refund_pending, leaves the rest", () => {
    expect(nextPaymentStatusOnCancel("assumed_paid")).toBe("refund_pending");
    expect(nextPaymentStatusOnCancel("unpaid")).toBe("unpaid");
    expect(nextPaymentStatusOnCancel("flagged")).toBe("flagged");
    expect(nextPaymentStatusOnCancel("refund_pending")).toBe("refund_pending");
  });
});

// ── cancelBooking ─────────────────────────────────────────────────────────────

describe("cancelBooking", () => {
  it("cancels a paid subscriber: refund_pending, waitlist promoted, audited", async () => {
    const before = makeAttendance();
    const { sb, calls } = createMockSb([
      { data: before },
      { data: futureSession() },
      { data: { ...before, rsvp_status: "cancelled", payment_status: "refund_pending" } },
    ]);

    const result = await cancelBooking({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      attendanceId: ATT_ID,
      reason: "asked via WhatsApp",
    });

    expect(result).toEqual({ ok: true, mode: "cancelled" });
    expect(callsOf(calls, "update")[0]?.args[0]).toEqual({
      rsvp_status: "cancelled",
      payment_status: "refund_pending",
      marked_by: ADMIN_ID,
    });
    expect(promoteWaitlist).toHaveBeenCalledWith(SESSION_ID);
    expect(writeAudit).toHaveBeenCalledWith(
      ADMIN_ID,
      "admin_cancel_booking",
      "attendance",
      ATT_ID,
      before,
      expect.objectContaining({ reason: "asked via WhatsApp" }),
      sb,
    );
  });

  it("keeps an unpaid drop-in unpaid (no refund owed)", async () => {
    const before = makeAttendance({ source: "drop_in", payment_status: "unpaid" });
    const { sb, calls } = createMockSb([
      { data: before },
      { data: futureSession() },
      { data: { ...before, rsvp_status: "cancelled" } },
    ]);

    const result = await cancelBooking({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      attendanceId: ATT_ID,
    });

    expect(result).toEqual({ ok: true, mode: "cancelled" });
    expect(callsOf(calls, "update")[0]?.args[0]).toMatchObject({
      payment_status: "unpaid",
    });
  });

  it("does not promote the waitlist when cancelling a waitlisted row", async () => {
    const before = makeAttendance({
      source: "drop_in",
      rsvp_status: "waitlisted",
      payment_status: "unpaid",
    });
    const { sb } = createMockSb([
      { data: before },
      { data: futureSession() },
      { data: { ...before, rsvp_status: "cancelled" } },
    ]);

    const result = await cancelBooking({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      attendanceId: ATT_ID,
    });

    expect(result).toEqual({ ok: true, mode: "cancelled" });
    expect(promoteWaitlist).not.toHaveBeenCalled();
  });

  it("rejects rows that are not active (already cancelled)", async () => {
    const { sb, calls } = createMockSb([
      { data: makeAttendance({ rsvp_status: "cancelled" }) },
      { data: futureSession() },
    ]);

    const result = await cancelBooking({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      attendanceId: ATT_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: "Booking is not active",
      status: 400,
    });
    expect(callsOf(calls, "update")).toHaveLength(0);
    expect(writeAudit).not.toHaveBeenCalled();
  });

  it("rejects sessions that already started", async () => {
    const { sb } = createMockSb([
      { data: makeAttendance() },
      {
        data: futureSession({
          start_at: new Date(Date.now() - 3600 * 1000).toISOString(),
        }),
      },
    ]);

    const result = await cancelBooking({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      attendanceId: ATT_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: "Session has already started",
      status: 400,
    });
  });

  it("rejects non-scheduled sessions", async () => {
    const { sb } = createMockSb([
      { data: makeAttendance() },
      { data: futureSession({ status: "cancelled" }) },
    ]);

    const result = await cancelBooking({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      attendanceId: ATT_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: "Session is not open",
      status: 400,
    });
  });

  it("returns 404 for a missing booking", async () => {
    const { sb } = createMockSb([{ data: null }]);

    const result = await cancelBooking({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      attendanceId: ATT_ID,
    });

    expect(result).toEqual({
      ok: false,
      error: "Booking not found",
      status: 404,
    });
  });

  it("deletes the guest account for trial guest rows", async () => {
    const before = makeAttendance({ source: "referral" });
    const { sb, calls } = createMockSb([
      { data: before },
      { data: futureSession() },
      {
        data: {
          id: PLAYER_ID,
          username: "guest-jane-a1b2",
          display_name: "Jane",
          referred_by: REFERRER_ID,
          free_trial_used: true,
        },
      },
      { data: null, error: null }, // players delete
    ]);

    const result = await cancelBooking({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      attendanceId: ATT_ID,
      reason: "no-show risk",
    });

    expect(result).toEqual({ ok: true, mode: "guest_deleted" });
    expect(callsOf(calls, "delete")).toHaveLength(1);
    expect(callsOf(calls, "update")).toHaveLength(0);
    expect(promoteWaitlist).toHaveBeenCalledWith(SESSION_ID);
    expect(writeAudit).toHaveBeenCalledWith(
      ADMIN_ID,
      "admin_cancel_booking",
      "attendance",
      ATT_ID,
      before,
      expect.objectContaining({
        mode: "guest_deleted",
        guest_id: PLAYER_ID,
        reason: "no-show risk",
      }),
      sb,
    );
  });

  it("falls back to a regular cancel for referral rows without referred_by", async () => {
    const before = makeAttendance({ source: "referral" });
    const { sb, calls } = createMockSb([
      { data: before },
      { data: futureSession() },
      { data: { id: PLAYER_ID, referred_by: null } },
      { data: { ...before, rsvp_status: "cancelled" } }, // attendance update
    ]);

    const result = await cancelBooking({
      sb: sb as unknown as SupabaseClient,
      actorId: ADMIN_ID,
      attendanceId: ATT_ID,
    });

    expect(result).toEqual({ ok: true, mode: "cancelled" });
    expect(callsOf(calls, "delete")).toHaveLength(0);
    expect(callsOf(calls, "update")).toHaveLength(1);
  });
});
