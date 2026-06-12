import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/get-session";
import { cancelSeasonSubscription } from "@/lib/admin/cancel-season-subscription";

// Admin cancels a player's whole season subscription: every subscription
// attendance row in the season's future scheduled sessions is cancelled,
// paid rows are marked refund_pending (refund settles personally).
const schema = z.object({
  playerId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const result = await cancelSeasonSubscription({
    sb: createServerSupabase(),
    actorId: session.sub,
    seasonId: id,
    playerId: parsed.data.playerId,
    reason: parsed.data.reason || undefined,
  });
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, cancelledCount: result.cancelledCount });
}
