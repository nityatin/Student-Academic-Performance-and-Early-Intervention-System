import { NextResponse } from "next/server";
import { pool } from "@/lib/pg";
import { requireSession, errorResponse, HttpError } from "@/lib/auth";
import { canAccessStudent } from "@/lib/queries";

export const dynamic = "force-dynamic";

const ALLOWED = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

// PATCH /api/interventions/:id  { status }
// Admin: any intervention. Mentor: only interventions of their own mentees.
// The BEFORE UPDATE trigger stamps closed_on and writes an audit_log row.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession(["ADMIN", "MENTOR"]);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const status = String(body?.status ?? "");
    if (!ALLOWED.includes(status)) throw new HttpError(400, "Invalid status");

    const found = await pool.query("SELECT srn FROM intervention WHERE intervention_id = $1", [Number(id)]);
    if (found.rowCount === 0) throw new HttpError(404, "Not found");
    if (!(await canAccessStudent(s, found.rows[0].srn))) throw new HttpError(403, "This is not your mentee");

    const { rows } = await pool.query(
      `UPDATE intervention SET status = $1::intervention_status_t
       WHERE intervention_id = $2
       RETURNING intervention_id, srn, status, closed_on`,
      [status, Number(id)]
    );
    return NextResponse.json(rows[0]);
  } catch (e) {
    return errorResponse(e);
  }
}
