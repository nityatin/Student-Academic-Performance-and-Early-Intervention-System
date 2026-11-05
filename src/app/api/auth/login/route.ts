import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/pg";
import { COOKIE, SESSION_HOURS, Session, signSession } from "@/lib/token";

export const dynamic = "force-dynamic";

// Equalises response time for unknown emails so account existence is not revealed by timing.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// Simple in-memory throttle: 5 failed attempts per email+IP in 10 minutes.
const attempts = new Map<string, { n: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = `${email}|${ip}`;
  const rec = attempts.get(key);
  if (rec && Date.now() - rec.first < WINDOW_MS && rec.n >= MAX_FAILS) {
    return NextResponse.json({ error: "Too many failed attempts. Try again in a few minutes." }, { status: 429 });
  }

  const { rows } = await pool.query(
    `SELECT user_id, email, password_hash, full_name, role, faculty_id, srn
     FROM app_user WHERE email = $1`,
    [email]
  );
  const u = rows[0];
  const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH);

  if (!u || !ok) {
    const fresh = !rec || Date.now() - rec.first >= WINDOW_MS;
    attempts.set(key, { n: fresh ? 1 : rec.n + 1, first: fresh ? Date.now() : rec.first });
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }
  attempts.delete(key);

  const session: Session = {
    uid: u.user_id,
    email: u.email,
    name: u.full_name,
    role: u.role,
    facultyId: u.faculty_id,
    srn: u.srn,
  };
  const token = await signSession(session);
  const res = NextResponse.json({ role: session.role, srn: session.srn });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
}
