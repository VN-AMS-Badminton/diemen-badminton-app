import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE_NAME,
  verifySession,
  type SessionPayload,
} from "@/lib/auth/session";

// Returns the session payload or null. Use in RSCs / server actions.
export async function getOptionalSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

// Requires an authenticated session. Redirects to / if missing.
export async function requireSession(): Promise<SessionPayload> {
  const s = await getOptionalSession();
  if (!s) redirect("/");
  return s;
}

// Requires an authenticated admin. Returns 403 page via redirect.
export async function requireAdmin(): Promise<SessionPayload> {
  const s = await requireSession();
  if (s.role !== "admin") redirect("/forbidden");
  return s;
}
