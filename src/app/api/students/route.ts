import { NextRequest, NextResponse } from "next/server";
import { listStudents } from "@/lib/queries";
import { requireSession, errorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const s = await requireSession(["ADMIN", "MENTOR"]);
    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const risk = req.nextUrl.searchParams.get("risk") ?? undefined;
    return NextResponse.json(await listStudents(s, q, risk));
  } catch (e) {
    return errorResponse(e);
  }
}
