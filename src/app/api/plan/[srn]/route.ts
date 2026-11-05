import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getMongoDb } from "@/lib/mongo";
import { requireSession, errorResponse, HttpError } from "@/lib/auth";
import { canAccessStudent } from "@/lib/queries";
import type { Session } from "@/lib/token";

export const dynamic = "force-dynamic";

async function guard(srn: string): Promise<Session> {
  const s = await requireSession(["ADMIN", "MENTOR"]);
  if (!(await canAccessStudent(s, srn))) throw new HttpError(403, "This is not your mentee");
  return s;
}

// CREATE  POST /api/plan/:srn  { title }  -> adds a step (creates the plan if the student has none)
export async function POST(req: Request, { params }: { params: Promise<{ srn: string }> }) {
  try {
    const { srn } = await params;
    await guard(srn);
    const body = await req.json().catch(() => null);
    const title = String(body?.title ?? "").trim();
    if (!title) throw new HttpError(400, "Step title is required");
    const mdb = await getMongoDb();
    const step = { id: randomUUID(), title, done: false };
    await mdb.collection("intervention_plans").updateOne(
      { srn },
      {
        $push: { steps: step },
        $set: { updatedAt: new Date() },
        $setOnInsert: { goal: "Improve attendance and internal marks", resources: [] },
      } as never,
      { upsert: true }
    );
    return NextResponse.json(step, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

// UPDATE  PATCH /api/plan/:srn  { stepId, done?, title? }
export async function PATCH(req: Request, { params }: { params: Promise<{ srn: string }> }) {
  try {
    const { srn } = await params;
    await guard(srn);
    const body = await req.json().catch(() => null);
    const stepId = String(body?.stepId ?? "");
    if (!stepId) throw new HttpError(400, "stepId is required");
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body?.done === "boolean") set["steps.$.done"] = body.done;
    if (typeof body?.title === "string" && body.title.trim()) set["steps.$.title"] = body.title.trim();
    const mdb = await getMongoDb();
    const res = await mdb
      .collection("intervention_plans")
      .updateOne({ srn, "steps.id": stepId }, { $set: set });
    if (res.matchedCount === 0) throw new HttpError(404, "Step not found");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE  DELETE /api/plan/:srn  { stepId }
export async function DELETE(req: Request, { params }: { params: Promise<{ srn: string }> }) {
  try {
    const { srn } = await params;
    await guard(srn);
    const body = await req.json().catch(() => null);
    const stepId = String(body?.stepId ?? "");
    if (!stepId) throw new HttpError(400, "stepId is required");
    const mdb = await getMongoDb();
    await mdb
      .collection("intervention_plans")
      .updateOne({ srn }, { $pull: { steps: { id: stepId } }, $set: { updatedAt: new Date() } } as never);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
