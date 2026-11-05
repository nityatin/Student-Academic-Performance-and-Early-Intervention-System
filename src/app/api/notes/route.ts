import { NextRequest, NextResponse } from "next/server";
import { getMongoDb } from "@/lib/mongo";
import { requireSession, errorResponse, HttpError } from "@/lib/auth";
import { canAccessStudent } from "@/lib/queries";
import { pool } from "@/lib/pg";

export const dynamic = "force-dynamic";

function cleanTags(raw: unknown): string[] {
  return Array.isArray(raw)
    ? [...new Set(raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean))]
    : [];
}

// READ  GET /api/notes?srn=...&tag=...   (any role, only for students they may see)
export async function GET(req: NextRequest) {
  try {
    const s = await requireSession();
    const srn = req.nextUrl.searchParams.get("srn") ?? "";
    const tag = req.nextUrl.searchParams.get("tag") ?? undefined;
    if (!srn || !(await canAccessStudent(s, srn))) throw new HttpError(404, "Student not found");
    const mdb = await getMongoDb();
    const notes = await mdb
      .collection("counselling_notes")
      .find(tag ? { srn, tags: tag } : { srn })
      .sort({ createdAt: -1 })
      .toArray();
    return NextResponse.json(notes);
  } catch (e) {
    return errorResponse(e);
  }
}

// CREATE POST /api/notes  { srn, text, tags[] }   (admin, or the student's mentor)
export async function POST(req: Request) {
  try {
    const s = await requireSession(["ADMIN", "MENTOR"]);
    const body = await req.json().catch(() => null);
    const srn = String(body?.srn ?? "").trim();
    const text = String(body?.text ?? "").trim();
    const tags = cleanTags(body?.tags);
    if (!srn || !text) throw new HttpError(400, "srn and text are required");

    const exists = await pool.query("SELECT 1 FROM student WHERE srn = $1", [srn]);
    if (exists.rowCount === 0) throw new HttpError(404, "Unknown SRN");
    if (!(await canAccessStudent(s, srn))) throw new HttpError(403, "This is not your mentee");

    try {
      const mdb = await getMongoDb();
      const doc = { srn, author: s.name, authorEmail: s.email, text, tags, createdAt: new Date() };
      const res = await mdb.collection("counselling_notes").insertOne(doc);
      return NextResponse.json({ _id: String(res.insertedId), ...doc }, { status: 201 });
    } catch {
      throw new HttpError(503, "MongoDB is not reachable. Is the container running?");
    }
  } catch (e) {
    return errorResponse(e);
  }
}
