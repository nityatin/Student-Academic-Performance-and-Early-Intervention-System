"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NoteView } from "@/lib/queries";
import { fmtDate } from "@/lib/format";

export default function NoteList({ notes }: { notes: NoteView[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [err, setErr] = useState("");

  function startEdit(n: NoteView) {
    setEditing(n._id);
    setText(n.text);
    setTags(n.tags.join(", "));
    setErr("");
  }

  async function save(id: string) {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Could not update the note");
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this note? This cannot be undone.")) return;
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  const input =
    "w-full rounded border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink";
  const link = "text-xs text-slate2 hover:text-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ink";

  return (
    <div className="space-y-4">
      {notes.map((n) => (
        <article key={n._id} className="text-sm">
          {editing === n._id ? (
            <div className="space-y-2">
              <textarea className={input} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
              <input className={input} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" />
              {err && <p role="alert" className="text-sm text-risk-high">{err}</p>}
              <div className="flex gap-3">
                <button onClick={() => save(n._id)} className="rounded bg-ink px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2">
                  Save changes
                </button>
                <button onClick={() => setEditing(null)} className={link}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <p>{n.text}</p>
              <p className="mt-1 text-xs text-slate2">
                {n.author} · {fmtDate(n.createdAt)}
                {n.updatedAt && ` (edited ${fmtDate(n.updatedAt)})`}
                {n.tags.length > 0 && ` · ${n.tags.join(", ")}`}
              </p>
              {n.canEdit && (
                <div className="mt-1 flex gap-3">
                  <button onClick={() => startEdit(n)} className={link}>Edit</button>
                  <button onClick={() => remove(n._id)} className={link}>Delete</button>
                </div>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
