import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

const PUBLIC_PATHS = [
  "/",
  "/register",
  "/forbidden",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
];

function isPublic(path: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`) || path.startsWith(p + "?"),
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon"))
    return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && session.role !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = "/forbidden";
    return NextResponse.redirect(url);
  }

  // Forward session info to RSCs via headers (optional; RSCs can also read cookies).
  const res = NextResponse.next();
  res.headers.set("x-player-id", session.sub);
  res.headers.set("x-player-role", session.role);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
