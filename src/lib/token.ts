// Edge-safe session token helpers (used by middleware and by server code). No Node-only imports here.
import { SignJWT, jwtVerify } from "jose";

export type Role = "ADMIN" | "MENTOR" | "STUDENT";

export interface Session {
  uid: number;
  email: string;
  name: string;
  role: Role;
  facultyId: number | null; // set for MENTOR
  srn: string | null;       // set for STUDENT
}

export const COOKIE = "sapeis_session";
export const SESSION_HOURS = 8;

function key(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters. See .env.example.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function verifySession(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload as unknown as Session;
  } catch {
    return null;
  }
}
