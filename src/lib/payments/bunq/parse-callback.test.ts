import { describe, expect, it } from "vitest";
import { parseBunqCallback } from "./parse-callback";

describe("parseBunqCallback", () => {
  it("parses the nested NotificationUrl → object → Payment wrapper", () => {
    const body = {
      NotificationUrl: {
        category: "MUTATION",
        event_type: "MUTATION_CREATED",
        object: {
          Payment: {
            id: 12345,
            amount: { value: "7.50", currency: "EUR" },
            description: "drop in alice",
            created: "2026-06-07T10:00:00.000000Z",
          },
        },
      },
    };
    const p = parseBunqCallback(body);
    expect(p).not.toBeNull();
    expect(p!.paymentId).toBe("12345");
    expect(p!.amountCents).toBe(750);
    expect(p!.currency).toBe("EUR");
    expect(p!.description).toBe("drop in alice");
    expect(p!.created).toBe("2026-06-07T10:00:00.000000Z");
  });

  it("parses a flat payment object (no wrapper)", () => {
    const p = parseBunqCallback({
      id: 9,
      amount: { value: "30.00", currency: "EUR" },
      description: "sub",
    });
    expect(p!.paymentId).toBe("9");
    expect(p!.amountCents).toBe(3000);
    expect(p!.created).toBeNull();
  });

  it("keeps sign for outgoing (negative) amounts", () => {
    const p = parseBunqCallback({
      id: 5,
      amount: { value: "-10.00", currency: "EUR" },
      description: "refund",
    });
    expect(p!.amountCents).toBe(-1000);
  });

  it("returns null when no payment object present", () => {
    expect(parseBunqCallback({ NotificationUrl: { object: {} } })).toBeNull();
    expect(parseBunqCallback({ foo: "bar" })).toBeNull();
    expect(parseBunqCallback(null)).toBeNull();
    expect(parseBunqCallback("garbage")).toBeNull();
  });

  it("returns null when id or amount missing", () => {
    expect(
      parseBunqCallback({ id: 1, description: "no amount" }),
    ).toBeNull();
    expect(
      parseBunqCallback({ amount: { value: "1.00" }, description: "no id" }),
    ).toBeNull();
  });
});
