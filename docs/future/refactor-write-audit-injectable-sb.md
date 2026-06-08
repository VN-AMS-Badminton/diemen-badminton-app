# Suggestion: Make `writeAudit` accept an injectable Supabase client

## Problem

`src/lib/admin/audit.ts` currently calls `createServerSupabase()` internally:

```ts
export async function writeAudit(...) {
  const sb = createServerSupabase(); // ← hardcoded, not injectable
  await sb.from("audit_log").insert({ ... });
}
```

This means any library function that injects `sb` for testability (e.g. `passSlot`) **cannot use `writeAudit`** without breaking the mock boundary — the audit write silently opens a second real DB connection, bypassing the injected mock entirely.

## Proposed change

Add an optional `sb` parameter that falls back to `createServerSupabase()` when omitted:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { createServerSupabase } from "@/lib/supabase/server";

export async function writeAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
  sb?: SupabaseClient<Database>,
): Promise<void> {
  const client = sb ?? createServerSupabase();
  await client.from("audit_log").insert({
    actor_id: actorId,
    action,
    entity,
    entity_id: entityId,
    before_json: (before ?? null) as never,
    after_json: (after ?? null) as never,
  });
}
```

All existing callers stay unchanged (they don't pass `sb`, so the default applies). New library functions with an injected client can pass it through.

## Impact

- No breaking changes — `sb` is optional, all existing call sites compile as-is.
- `passSlot` (and any future injectable lib function) can replace the inline `audit_log` insert with `writeAudit(...)`, keeping audit logic in one place.
- Tests can verify the audit write through the same mock client used for the rest of the function.
