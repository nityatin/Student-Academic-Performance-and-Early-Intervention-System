import { NextResponse } from "next/server";
import { getDashboard } from "@/lib/queries";
import { requireSession, errorResponse } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await requireSession(["ADMIN", "MENTOR"]);
    return NextResponse.json(await getDashboard(s));
  } catch (e) {
    return errorResponse(e);
  }
}
