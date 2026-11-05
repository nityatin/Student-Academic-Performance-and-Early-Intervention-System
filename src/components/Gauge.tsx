// Thin horizontal bar with a marker at the risk threshold, so the cut-off is visible at a glance.
export default function Gauge({
  value,
  threshold,
  label,
}: {
  value: number | null;
  threshold: number;
  label: string;
}) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const below = v < threshold;
  return (
    <div className="min-w-[120px]">
      <div className="mb-1 flex justify-between text-xs text-slate2">
        <span>{label}</span>
        <span className={below ? "font-semibold text-risk-high" : ""}>{value == null ? "—" : `${v.toFixed(1)}%`}</span>
      </div>
      <div className="relative h-2 rounded-full bg-line">
        <div
          className={`h-2 rounded-full ${below ? "bg-risk-high" : "bg-ink"}`}
          style={{ width: `${v}%` }}
        />
        <div
          className="absolute -top-1 h-4 w-px bg-slate2"
          style={{ left: `${threshold}%` }}
          title={`Threshold ${threshold}%`}
        />
      </div>
    </div>
  );
}
