// Server-side auth helpers for pages and route handlers.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, Role, Session, verifySession } from "./token";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return verifySession(token);
}

// Throws 401 when signed out and 403 when the role is not in the allowed list.
export async function requireSession(roles?: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "You are not signed in");
  if (roles && !roles.includes(s.role)) throw new HttpError(403, "Your role is not allowed to do this");
  return s;
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Something went wrong on the server" }, { status: 500 });
}
