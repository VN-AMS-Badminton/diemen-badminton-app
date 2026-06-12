// Proxy-based chainable Supabase mock shared by the admin lib tests.
// Same strategy as src/lib/sessions/__tests__/pass-slot.test.ts — every fluent
// chain method returns another Proxy sharing one response queue; terminal
// operations (direct `await` or `.maybeSingle()`) pop the next queued
// response — extended with a call log so tests can assert update/delete
// payloads and target tables.

export type MockResponse = {
  data?: unknown;
  count?: number | null;
  error?: unknown;
};

export interface RecordedCall {
  method: string;
  args: unknown[];
}

export function createMockSb(responses: MockResponse[]) {
  const queue = [...responses];
  const calls: RecordedCall[] = [];

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
        // All other methods (select, eq, in, update, delete, …) chain.
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args });
          return makeBuilder();
        };
      },
    };
    return new Proxy({}, handler);
  }

  const sb = {
    from: (table: string) => {
      calls.push({ method: "from", args: [table] });
      return makeBuilder();
    },
  };

  return { sb, calls };
}

/** All recorded calls of one method, e.g. every `update` payload. */
export function callsOf(calls: RecordedCall[], method: string): RecordedCall[] {
  return calls.filter((c) => c.method === method);
}
