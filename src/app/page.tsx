import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboard } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import RiskBadge from "@/components/RiskBadge";
import Gauge from "@/components/Gauge";
import RefreshButton from "@/components/RefreshButton";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STUDENT") redirect(`/students/${session.srn}`);
  const d = await getDashboard(session);
  const isAdmin = session.role === "ADMIN";
  const total = d.byRisk.HIGH + d.byRisk.MEDIUM + d.byRisk.LOW;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{isAdmin ? "Who needs help this week" : "Your mentees this week"}</h1>
          <p className="mt-1 text-sm text-slate2">
            {d.byRisk.HIGH} of {total} students are at high risk. {d.openInterventions} interventions are active.
          </p>
        </div>
        {isAdmin && <RefreshButton />}
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {(["HIGH", "MEDIUM", "LOW"] as const).map((lvl) => (
          <Link
            key={lvl}
            href={`/students?risk=${lvl}`}
            className="rounded-lg border border-line bg-white p-5 hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <div className="flex items-center justify-between">
              <RiskBadge level={lvl} />
              <span className="text-3xl font-semibold">{d.byRisk[lvl]}</span>
            </div>
            <p className="mt-2 text-xs text-slate2">
              {lvl === "HIGH" && "Attendance under 65% or average score under 40%"}
              {lvl === "MEDIUM" && "Attendance under 75% or average score under 55%"}
              {lvl === "LOW" && "On track"}
            </p>
          </Link>
        ))}
      </section>

      <section className="rounded-lg border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Students to follow up</h2>
        {d.atRisk.length === 0 ? (
          <p className="p-5 text-sm text-slate2">No students are flagged right now.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.atRisk.map((s) => (
              <li key={s.srn} className="grid items-center gap-4 px-5 py-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                <div>
                  <Link href={`/students/${s.srn}`} className="font-medium hover:underline">{s.name}</Link>
                  <div className="text-xs text-slate2">{s.srn} · Mentor: {s.mentor ?? "unassigned"}</div>
                </div>
                <Gauge value={s.attendance_pct} threshold={75} label="Attendance" />
                <Gauge value={s.avg_score_pct} threshold={55} label="Avg score" />
                <RiskBadge level={s.risk_level} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 font-semibold">Common concerns in counselling notes</h2>
          {d.topTags.length === 0 ? (
            <p className="p-5 text-sm text-slate2">No notes yet, or MongoDB is not running.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.topTags.map((t) => (
                <li key={t.tag} className="flex justify-between px-5 py-2 text-sm">
                  <span>{t.tag}</span>
                  <span className="text-slate2">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {isAdmin && (
        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 font-semibold">Recent intervention changes</h2>
          {d.audit.length === 0 ? (
            <p className="p-5 text-sm text-slate2">Status changes will appear here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.audit.map((a, i) => (
                <li key={i} className="px-5 py-2 text-sm">
                  {a.detail}
                  <div className="text-xs text-slate2">{fmtDate(a.logged_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}
      </div>
    </div>
  );
}
