import { NextResponse } from "next/server";
import { pool } from "@/lib/pg";
import { requireSession, errorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Recomputes every student's risk by calling the stored procedure. Admin only: it touches all students.
export async function POST() {
  try {
    await requireSession(["ADMIN"]);
    await pool.query("CALL sp_refresh_risk()");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
