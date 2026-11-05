"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Step {
  id: string;
  title: string;
  done: boolean;
}

export default function PlanEditor({
  srn,
  goal,
  steps,
  support,
  canManage,
}: {
  srn: string;
  goal: string | null;
  steps: Step[];
  support: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");

  async function call(method: string, body: object) {
    setErr("");
    const res = await fetch(`/api/plan/${srn}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Could not update the plan");
      return false;
    }
    router.refresh();
    return true;
  }

  async function add() {
    if (await call("POST", { title })) setTitle("");
  }

  return (
    <div className="text-sm">
      {goal ? (
        <p className="font-medium">{goal}</p>
      ) : (
        <p className="text-slate2">
          {canManage ? "No plan yet. Add a first step to start one." : "No improvement plan has been created for this student."}
        </p>
      )}
      {steps.length > 0 && (
        <ul className="mt-3 space-y-2">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.done}
                  disabled={!canManage}
                  onChange={(e) => call("PATCH", { stepId: s.id, done: e.target.checked })}
                />
                <span className={s.done ? "text-slate2 line-through" : ""}>{s.title}</span>
              </label>
              {canManage && (
                <button
                  onClick={() => call("DELETE", { stepId: s.id })}
                  className="text-xs text-slate2 hover:text-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {support && <p className="mt-3 text-xs text-slate2">Support: {support}</p>}
      {canManage && (
        <div className="mt-4 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New step"
            className="w-full rounded border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          />
          <button
            onClick={add}
            disabled={!title.trim()}
            className="rounded bg-ink px-3 py-2 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60"
          >
            Add
          </button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-risk-high">{err}</p>}
    </div>
  );
}
