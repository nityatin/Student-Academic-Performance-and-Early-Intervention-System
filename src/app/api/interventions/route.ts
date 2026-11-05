import { NextRequest, NextResponse } from "next/server";
import { listInterventions } from "@/lib/queries";
import { requireSession, errorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const s = await requireSession(["ADMIN", "MENTOR"]);
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    return NextResponse.json(await listInterventions(s, status));
  } catch (e) {
    return errorResponse(e);
  }
}
