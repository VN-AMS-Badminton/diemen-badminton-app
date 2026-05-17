import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/get-session";
import { createServerSupabase } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/admin/audit";

// Admin tool: reset a referred guest's free_trial_used flag back to false so
// they can be referred again. Preserves referred_by (history is sacred).
// Refunding the referrer's monthly cap is a separate action.
const schema = z.object({ playerId: z.string().uuid() });

export async function POST(req: Request) {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const sb = createServerSupabase();
  const { data: before } = await sb
    .from("players")
    .select("id, referred_by, free_trial_used")
    .eq("id", parsed.data.playerId)
    .maybeSingle();
  if (!before) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  if (!before.referred_by) {
    return NextResponse.json(
      { error: "Player is not a referral guest" },
      { status: 400 },
    );
  }
  if (!before.free_trial_used) {
    return NextResponse.json({ ok: true }); // idempotent
  }

  const { error } = await sb
    .from("players")
    .update({ free_trial_used: false })
    .eq("id", before.id);
  if (error) {
    return NextResponse.json({ error: "Could not reset trial" }, { status: 500 });
  }

  await writeAudit(admin.sub, "reset_free_trial", "player", before.id, {
    free_trial_used: true,
  }, { free_trial_used: false });

  return NextResponse.json({ ok: true });
}
