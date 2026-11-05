"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO = [
  { role: "Admin", email: "admin@pes.edu", password: "Admin@123" },
  { role: "Mentor", email: "shilpa.s@pes.edu", password: "Mentor@123" },
  { role: "Student", email: "kabir.menon@stu.pes.edu", password: "Student@123" },
];

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error ?? "Could not sign in");
      return;
    }
    const dest = j.role === "STUDENT" ? `/students/${j.srn}` : next && next.startsWith("/") ? next : "/";
    router.push(dest);
    router.refresh();
  }

  const input =
    "w-full rounded border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink";

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate2">Email</span>
          <input className={input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate2">Password</span>
          <input className={input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {err && <p role="alert" className="text-sm text-risk-high">{err}</p>}
        <button
          disabled={busy}
          className="w-full rounded bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="rounded border border-line bg-surface p-3 text-xs text-slate2">
        <p className="mb-2 font-medium text-ink">Demo accounts (click to fill)</p>
        <ul className="space-y-1">
          {DEMO.map((d) => (
            <li key={d.role}>
              <button
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(d.password);
                }}
                className="text-left hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
              >
                <span className="font-medium text-ink">{d.role}</span>: {d.email}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
