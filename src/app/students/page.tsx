import Link from "next/link";
import { redirect } from "next/navigation";
import { listStudents } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import RiskBadge from "@/components/RiskBadge";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Students({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; risk?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STUDENT") redirect(`/students/${session.srn}`);
  const { q, risk } = await searchParams;
  const students = await listStudents(session, q, risk);
  const chip = (label: string, value?: string) => {
    const active = (risk ?? "") === (value ?? "");
    const href = `/students?${new URLSearchParams({ ...(q ? { q } : {}), ...(value ? { risk: value } : {}) })}`;
    return (
      <Link
        key={label}
        href={href}
        className={`rounded-full border px-3 py-1 text-sm ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{session.role === "ADMIN" ? "Students" : "Your mentees"}</h1>
      <form className="flex flex-wrap items-center gap-3" action="/students">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by name or SRN"
          className="w-64 rounded border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        />
        {risk && <input type="hidden" name="risk" value={risk} />}
        <button className="rounded bg-ink px-4 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
          Search
        </button>
        <div className="flex gap-2">
          {chip("All")}
          {chip("High", "HIGH")}
          {chip("Medium", "MEDIUM")}
          {chip("Low", "LOW")}
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-slate2">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Sem / Sec</th>
              <th className="px-4 py-3 font-medium">Mentor</th>
              <th className="px-4 py-3 font-medium">Attendance</th>
              <th className="px-4 py-3 font-medium">Avg score</th>
              <th className="px-4 py-3 font-medium">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {students.map((s) => (
              <tr key={s.srn} className="hover:bg-surface">
                <td className="px-4 py-3">
                  <Link href={`/students/${s.srn}`} className="font-medium hover:underline">
                    {s.name}
                  </Link>
                  <div className="text-xs text-slate2">{s.srn}</div>
                </td>
                <td className="px-4 py-3">
                  {s.semester} / {s.section}
                </td>
                <td className="px-4 py-3">{s.mentor ?? "—"}</td>
                <td className="px-4 py-3">{pct(s.attendance_pct)}</td>
                <td className="px-4 py-3">{pct(s.avg_score_pct)}</td>
                <td className="px-4 py-3">
                  <RiskBadge level={s.risk_level} />
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate2">
                  No students match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
