import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/token";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p);

  if (isPublic) {
    if (session && pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "You are not signed in" }, { status: 401 });
    }
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Students only ever see their own record page. Route handlers enforce the same rule on data.
  if (session.role === "STUDENT" && !pathname.startsWith("/api/")) {
    const own = `/students/${session.srn}`;
    if (pathname !== own) return NextResponse.redirect(new URL(own, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
