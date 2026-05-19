import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}

// GET handler so server-side redirects (e.g. stale-session recovery) can
// clear the cookie and bounce the user back to the login screen.
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url));
  clearSessionCookie(res);
  return res;
}
