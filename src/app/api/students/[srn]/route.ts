import { NextRequest, NextResponse } from "next/server";
import { getStudentDetail } from "@/lib/queries";
import { requireSession, errorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ srn: string }> }) {
  try {
    const s = await requireSession();
    const { srn } = await params;
    const tag = req.nextUrl.searchParams.get("tag") ?? undefined;
    const data = await getStudentDetail(s, srn, tag);
    if (!data) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
