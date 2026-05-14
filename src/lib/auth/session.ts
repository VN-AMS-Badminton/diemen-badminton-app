import { SignJWT, jwtVerify } from "jose";
import type { PlayerRole } from "@/lib/db/types";

const COOKIE_NAME = "session";
const ALG = "HS256";
const TTL_DAYS = 30;

export interface SessionPayload {
  sub: string;
  role: PlayerRole;
  iat?: number;
  exp?: number;
}

function getSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET missing");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: {
  sub: string;
  role: PlayerRole;
}): Promise<string> {
  return new SignJWT({ sub: payload.sub, role: payload.role })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TTL_DAYS}d`)
    .sign(getSecret());
}

export async function verifySession(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALG],
    });
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") {
      return null;
    }
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;
