import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reconcileBunqPayment } from "./reconcile";
import type { ParsedPayment } from "./parse-callback";

// ── Mock Supabase client ──────────────────────────────────────────────────
// Per-table response queues popped on each terminal op (.maybeSingle() or
// awaited builder). `.update()` / `.insert()` payloads are captured for asserts.

interface Captures {
  updates: { table: string; payload: Record<string, unknown> }[];
  inserts: { table: string; payload: Record<string, unknown> }[];
}

function createSb(
  responses: Record<string, Array<{ data?: unknown; count?: number | null; error?: unknown }>>,
  captures: Captures,
) {
  function builder(table: string) {
    const queue = responses[table] ?? [];
    const next = () => Promise.resolve(queue.shift() ?? { data: null, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    const chain = () => b;
    b.select = chain;
    b.eq = chain;
    b.gte = chain;
    b.lt = chain;
    b.order = chain;
    b.limit = chain;
    b.update = (payload: Record<string, unknown>) => {
      captures.updates.push({ table, payload });
      return b;
    };
    b.insert = (payload: Record<string, unknown>) => {
      captures.inserts.push({ table, payload });
      return Promise.resolve({ error: null });
    };
    b.maybeSingle = () => next();
    b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
      next().then(onF, onR);
    return b;
  }
  return { from: (table: string) => builder(table) } as unknown as SupabaseClient;
}

const PAYMENT: ParsedPayment = {
  paymentId: "PAY1",
  amountCents: 750,
  currency: "EUR",
  description: "drop in alice",
  created: null,
};

const SESSION_ROW = {
  data: {
    id: "sess1",
    season_id: "seas1",
    seasons: {
      drop_in_fee_per_session_cents: 750,
      subscription_fee_per_session_cents: 1000,
    },
  },
};
const COUNT_3 = { count: 3 }; // subscription total = 3000
const ATTENDEE = (status: string) => ({
  data: [
    {
      id: "att1",
      player_id: "p1",
      source: "drop_in",
      payment_status: status,
      bunq_payment_id: null,
      players: { id: "p1", username: "alice", display_name: "Alice" },
    },
  ],
});

function emptyCaptures(): Captures {
  return { updates: [], inserts: [] };
}

describe("reconcileBunqPayment", () => {
  it("confirms an unpaid drop-in (unpaid → assumed_paid)", async () => {
    const cap = emptyCaptures();
    const sb = createSb(
      {
        attendance: [{ data: null }, ATTENDEE("unpaid"), { data: { id: "att1" } }],
        sessions: [SESSION_ROW, COUNT_3],
      },
      cap,
    );
    const res = await reconcileBunqPayment(sb, PAYMENT);
    expect(res.outcome).toBe("confirmed");
    expect(cap.updates[0].payload).toMatchObject({
      bunq_payment_id: "PAY1",
      payment_status: "assumed_paid",
    });
    expect(cap.inserts[0].payload).toMatchObject({ action: "bunq_confirmed" });
  });

  it("is idempotent — known payment id is a no-op", async () => {
    const cap = emptyCaptures();
    const sb = createSb({ attendance: [{ data: { id: "att1" } }] }, cap);
    const res = await reconcileBunqPayment(sb, PAYMENT);
    expect(res.outcome).toBe("duplicate");
    expect(cap.updates).toHaveLength(0);
  });

  it("records proof only when already assumed_paid", async () => {
    const cap = emptyCaptures();
    const sb = createSb(
      {
        attendance: [{ data: null }, ATTENDEE("assumed_paid"), { data: { id: "att1" } }],
        sessions: [SESSION_ROW, COUNT_3],
      },
      cap,
    );
    const res = await reconcileBunqPayment(sb, PAYMENT);
    expect(res.outcome).toBe("proof_recorded");
    expect(cap.updates[0].payload).toMatchObject({ bunq_payment_id: "PAY1" });
    expect(cap.updates[0].payload.payment_status).toBeUndefined();
    expect(cap.inserts[0].payload).toMatchObject({ action: "bunq_proof" });
  });

  it("unflags when a flagged row gets a matching payment", async () => {
    const cap = emptyCaptures();
    const sb = createSb(
      {
        attendance: [{ data: null }, ATTENDEE("flagged"), { data: { id: "att1" } }],
        sessions: [SESSION_ROW, COUNT_3],
      },
      cap,
    );
    const res = await reconcileBunqPayment(sb, PAYMENT);
    expect(res.outcome).toBe("unflagged");
    expect(cap.updates[0].payload).toMatchObject({ payment_status: "assumed_paid" });
  });

  it("leaves subscription-sized payments for admin (no mutation)", async () => {
    const cap = emptyCaptures();
    const sb = createSb(
      {
        attendance: [{ data: null }, ATTENDEE("unpaid")],
        sessions: [SESSION_ROW, COUNT_3],
      },
      cap,
    );
    const res = await reconcileBunqPayment(sb, { ...PAYMENT, amountCents: 3000 });
    expect(res.outcome).toBe("subscription_manual");
    expect(cap.updates).toHaveLength(0);
    expect(cap.inserts[0].payload).toMatchObject({ action: "bunq_subscription_payment" });
  });

  it("leaves an unmatched payment for admin (no mutation)", async () => {
    const cap = emptyCaptures();
    const sb = createSb(
      {
        attendance: [{ data: null }, ATTENDEE("unpaid")],
        sessions: [SESSION_ROW, COUNT_3],
      },
      cap,
    );
    const res = await reconcileBunqPayment(sb, {
      ...PAYMENT,
      description: "no name here",
    });
    expect(res.outcome).toBe("unclear");
    expect(cap.updates).toHaveLength(0);
    expect(cap.inserts[0].payload).toMatchObject({ action: "bunq_match_unclear" });
  });

  it("returns no_session when there is no upcoming session", async () => {
    const cap = emptyCaptures();
    const sb = createSb({ attendance: [{ data: null }], sessions: [{ data: null }] }, cap);
    const res = await reconcileBunqPayment(sb, PAYMENT);
    expect(res.outcome).toBe("no_session");
  });
});
