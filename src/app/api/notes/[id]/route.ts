import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getMongoDb } from "@/lib/mongo";
import { requireSession, errorResponse, HttpError } from "@/lib/auth";
import type { Session } from "@/lib/token";

export const dynamic = "force-dynamic";

// Admin may change any note. A mentor may change only notes they wrote themselves.
async function loadEditableNote(s: Session, id: string) {
  if (!ObjectId.isValid(id)) throw new HttpError(400, "Invalid note id");
  const mdb = await getMongoDb();
  const col = mdb.collection("counselling_notes");
  const note = await col.findOne({ _id: new ObjectId(id) });
  if (!note) throw new HttpError(404, "Note not found");
  const allowed = s.role === "ADMIN" || (s.role === "MENTOR" && note.authorEmail === s.email);
  if (!allowed) throw new HttpError(403, "You can only change your own notes");
  return { col, note };
}

// UPDATE  PATCH /api/notes/:id  { text?, tags? }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession(["ADMIN", "MENTOR"]);
    const { id } = await params;
    const { col, note } = await loadEditableNote(s, id);
    const body = await req.json().catch(() => null);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body?.text === "string") {
      const text = body.text.trim();
      if (!text) throw new HttpError(400, "Note text cannot be empty");
      set.text = text;
    }
    if (Array.isArray(body?.tags)) {
      set.tags = [...new Set((body.tags as unknown[]).map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
    }
    await col.updateOne({ _id: note._id }, { $set: set });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE  DELETE /api/notes/:id
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession(["ADMIN", "MENTOR"]);
    const { id } = await params;
    const { col, note } = await loadEditableNote(s, id);
    await col.deleteOne({ _id: note._id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
