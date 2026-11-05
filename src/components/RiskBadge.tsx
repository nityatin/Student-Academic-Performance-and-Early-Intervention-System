import type { RiskLevel } from "@/lib/queries";

const STYLE: Record<RiskLevel, string> = {
  HIGH: "bg-risk-high/10 text-risk-high border-risk-high/30",
  MEDIUM: "bg-risk-medium/10 text-risk-medium border-risk-medium/30",
  LOW: "bg-risk-low/10 text-risk-low border-risk-low/30",
};

export default function RiskBadge({ level }: { level: RiskLevel | null }) {
  if (!level) return <span className="text-slate2">—</span>;
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${STYLE[level]}`}>
      {level[0] + level.slice(1).toLowerCase()}
    </span>
  );
}
