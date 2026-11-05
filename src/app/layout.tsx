import "./globals.css";
import Link from "next/link";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "Student Academic Performance & Early Intervention System",
  description: "DBMS mini project: PostgreSQL + MongoDB + Next.js",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const link =
    "rounded px-3 py-1.5 text-sm hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white";
  return (
    <html lang="en">
      <body>
        <header className="bg-ink text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-3">
            <Link href="/" className="text-base font-semibold">
              Early Intervention
            </Link>
            {session && (
              <div className="flex flex-wrap items-center gap-2">
                <nav className="flex gap-1">
                  {session.role === "STUDENT" ? (
                    <Link href={`/students/${session.srn}`} className={link}>My record</Link>
                  ) : (
                    <>
                      <Link href="/" className={link}>Dashboard</Link>
                      <Link href="/students" className={link}>Students</Link>
                      <Link href="/interventions" className={link}>Interventions</Link>
                    </>
                  )}
                </nav>
                <span className="px-2 text-sm text-white/80">
                  {session.name} · {session.role.toLowerCase()}
                </span>
                <LogoutButton />
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
