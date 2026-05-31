import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/get-session";
import { inviteGuest } from "@/lib/guests/invite-guest";

const BodySchema = z.object({
  guestName: z.string().trim().min(2).max(64),
  guestPhone: z.string().trim().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authSession = await requireSession();
  const { id: sessionId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const result = await inviteGuest({
    sessionId,
    referrerId: authSession.sub,
    guestName: parsed.data.guestName,
    guestPhone: parsed.data.guestPhone,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, guestName: result.guestName });
}
