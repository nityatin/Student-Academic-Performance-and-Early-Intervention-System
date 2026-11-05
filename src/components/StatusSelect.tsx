"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function StatusSelect({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    setBusy(true);
    const res = await fetch(`/api/interventions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    if (res.ok) {
      setValue(next);
      router.refresh();
    }
  }

  return (
    <select
      aria-label="Intervention status"
      value={value}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="rounded border border-line bg-white px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      {OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o.replace("_", " ").toLowerCase()}
        </option>
      ))}
    </select>
  );
}
