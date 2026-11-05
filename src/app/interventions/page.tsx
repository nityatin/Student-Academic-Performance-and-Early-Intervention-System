import Link from "next/link";
import { redirect } from "next/navigation";
import { listInterventions } from "@/lib/queries";
import { getSession } from "@/lib/auth";
import RiskBadge from "@/components/RiskBadge";
import StatusSelect from "@/components/StatusSelect";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Interventions({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "STUDENT") redirect(`/students/${session.srn}`);
  const { status } = await searchParams;
  const rows = await listInterventions(session, status);
  const tabs = [
    ["All", ""],
    ["Open", "OPEN"],
    ["In progress", "IN_PROGRESS"],
    ["Resolved", "RESOLVED"],
    ["Closed", "CLOSED"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Interventions</h1>
      <div className="flex flex-wrap gap-2">
        {tabs.map(([label, value]) => {
          const active = (status ?? "") === value;
          return (
            <Link
              key={label}
              href={value ? `/interventions?status=${value}` : "/interventions"}
              className={`rounded-full border px-3 py-1 text-sm ${active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-slate2">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Faculty</th>
              <th className="px-4 py-3 font-medium">Opened</th>
              <th className="px-4 py-3 font-medium">Closed</th>
              <th className="px-4 py-3 font-medium">Risk</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.intervention_id}>
                <td className="px-4 py-3">
                  <Link href={`/students/${r.srn}`} className="font-medium hover:underline">
                    {r.student}
                  </Link>
                  <div className="text-xs text-slate2">{r.srn}</div>
                </td>
                <td className="px-4 py-3">{String(r.action_type).replace("_", " ").toLowerCase()}</td>
                <td className="px-4 py-3">{r.faculty ?? "—"}</td>
                <td className="px-4 py-3">{fmtDate(r.opened_on)}</td>
                <td className="px-4 py-3">{fmtDate(r.closed_on)}</td>
                <td className="px-4 py-3">
                  <RiskBadge level={r.risk_level} />
                </td>
                <td className="px-4 py-3">
                  <StatusSelect id={r.intervention_id} status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate2">
                  Nothing here. Recalculate risk on the dashboard to open interventions for high-risk
                  students.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
