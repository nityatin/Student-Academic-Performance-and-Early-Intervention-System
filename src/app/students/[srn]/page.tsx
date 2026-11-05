import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getStudentDetail } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import RiskBadge from "@/components/RiskBadge";
import Gauge from "@/components/Gauge";
import NoteForm from "@/components/NoteForm";
import NoteList from "@/components/NoteList";
import PlanEditor from "@/components/PlanEditor";
import StatusSelect from "@/components/StatusSelect";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ srn: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { srn } = await params;
  const { tag } = await searchParams;
  const data = await getStudentDetail(session, srn, tag);
  if (!data) notFound();
  const { student, courses, scores, interventions, notes, allTags, plan, canManage } = data;
  const isStudent = session.role === "STUDENT";

  const chip = (label: string, value?: string) => {
    const active = (tag ?? "") === (value ?? "");
    return (
      <Link
        key={label}
        href={value ? `/students/${srn}?tag=${encodeURIComponent(value)}` : `/students/${srn}`}
        className={`rounded-full border px-2.5 py-0.5 text-xs ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-8">
      <div>
        {!isStudent && (
          <Link href="/students" className="text-sm text-slate2 hover:underline">
            ← All students
          </Link>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{student.name}</h1>
          <RiskBadge level={student.risk_level} />
        </div>
        <p className="text-sm text-slate2">
          {student.srn} · Semester {student.semester}, Section {student.section} · Mentor:{" "}
          {student.mentor ?? "unassigned"}
        </p>
      </div>

      <section className="grid gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2">
        <Gauge value={student.attendance_pct} threshold={75} label="Overall attendance" />
        <Gauge value={student.avg_score_pct} threshold={55} label="Weighted internal score" />
      </section>

      <section className="rounded-lg border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Courses</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-slate2">
              <tr>
                <th className="px-5 py-2 font-medium">Course</th>
                <th className="px-5 py-2 font-medium">Faculty</th>
                <th className="px-5 py-2 font-medium">Attendance</th>
                <th className="px-5 py-2 font-medium">Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {courses.map((c) => (
                <tr key={c.course_code}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{c.title}</div>
                    <div className="text-xs text-slate2">{c.course_code}</div>
                  </td>
                  <td className="px-5 py-3">{c.faculty}</td>
                  <td className={`px-5 py-3 ${c.attendance_pct < 75 ? "font-semibold text-risk-high" : ""}`}>
                    {c.attendance_pct}%
                  </td>
                  <td className="px-5 py-3">
                    {scores
                      .filter((s) => s.course_code === c.course_code)
                      .map((s) => `${s.assessment}: ${s.marks}/${s.max_marks}`)
                      .join("  ·  ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white">
        <h2 className="border-b border-line px-5 py-3 font-semibold">Interventions</h2>
        {interventions.length === 0 ? (
          <p className="p-5 text-sm text-slate2">No interventions recorded for this student.</p>
        ) : (
          <ul className="divide-y divide-line">
            {interventions.map((i) => (
              <li
                key={i.intervention_id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
              >
                <div>
                  <span className="font-medium">{String(i.action_type).replace("_", " ").toLowerCase()}</span>
                  <span className="text-slate2">
                    {" "}
                    · opened {fmtDate(i.opened_on)} · closed {fmtDate(i.closed_on)} · {i.faculty ?? "unassigned"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <RiskBadge level={i.risk_level} />
                  {canManage ? (
                    <StatusSelect id={i.intervention_id} status={i.status} />
                  ) : (
                    <span className="text-sm">{String(i.status).replace("_", " ").toLowerCase()}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 font-semibold">Counselling notes</h2>
          <div className="space-y-4 p-5">
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chip("All")}
                {allTags.map((t) => chip(t, t))}
              </div>
            )}
            {notes.length === 0 && (
              <p className="text-sm text-slate2">
                {tag ? `No notes tagged “${tag}”.` : "No notes yet."}
                {canManage && !tag && " Add the first one below."}
              </p>
            )}
            <NoteList notes={notes} />
            {canManage && (
              <div className="border-t border-line pt-4">
                <NoteForm srn={student.srn} />
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white">
          <h2 className="border-b border-line px-5 py-3 font-semibold">Improvement plan</h2>
          <div className="p-5">
            <PlanEditor
              srn={student.srn}
              goal={plan?.goal ?? null}
              steps={plan?.steps ?? []}
              support={plan ? plan.resources.map((r) => `${r.type} (${r.name})`).join(", ") : ""}
              canManage={canManage}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
