import { describe, expect, it } from "vitest";
import { matchPayment, normalize, type MatchablePlayer } from "./match-payment";

const players: MatchablePlayer[] = [
  { id: "p1", username: "alice", display_name: "Alice Smith" },
  { id: "p2", username: "bob", display_name: "Bob Jones" },
  { id: "p3", username: "charlie", display_name: null },
];

const FEES = { dropInFeeCents: 750, subscriptionTotalCents: 3000 };

describe("normalize", () => {
  it("lowercases, collapses whitespace, strips diacritics", () => {
    expect(normalize("  Renée   VAN  Dijk ")).toBe("renee van dijk");
  });
});

describe("matchPayment — who", () => {
  it("high confidence on exactly one username hit", () => {
    const r = matchPayment({
      description: "drop in alice",
      amountCents: 750,
      players,
      ...FEES,
    });
    expect(r.confidence).toBe("high");
    expect(r.player?.id).toBe("p1");
    expect(r.scope).toBe("drop_in");
  });

  it("matches on display name too", () => {
    const r = matchPayment({
      description: "payment from Bob Jones",
      amountCents: 750,
      players,
      ...FEES,
    });
    expect(r.player?.id).toBe("p2");
  });

  it("no match → confidence none", () => {
    const r = matchPayment({
      description: "random unrelated text",
      amountCents: 750,
      players,
      ...FEES,
    });
    expect(r.confidence).toBe("none");
    expect(r.player).toBeNull();
  });

  it("ignores too-short names (<3 chars) to avoid mis-attribution", () => {
    const r = matchPayment({
      description: "payment bo",
      amountCents: 750,
      players: [{ id: "x", username: "bo", display_name: null }],
      ...FEES,
    });
    expect(r.confidence).toBe("none");
  });

  it("ambiguous (>1 player named) → confidence none", () => {
    const r = matchPayment({
      description: "alice and bob splitting",
      amountCents: 750,
      players,
      ...FEES,
    });
    expect(r.confidence).toBe("none");
    expect(r.player).toBeNull();
  });
});

describe("matchPayment — scope by amount", () => {
  it("drop-in fee → drop_in", () => {
    expect(
      matchPayment({ description: "alice", amountCents: 750, players, ...FEES }).scope,
    ).toBe("drop_in");
  });

  it("subscription total → subscription", () => {
    expect(
      matchPayment({ description: "alice", amountCents: 3000, players, ...FEES }).scope,
    ).toBe("subscription");
  });

  it("neither → unknown", () => {
    expect(
      matchPayment({ description: "alice", amountCents: 999, players, ...FEES }).scope,
    ).toBe("unknown");
  });
});
