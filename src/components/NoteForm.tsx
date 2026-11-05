"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// The author is taken from the signed-in user on the server, so it is not typed here.
export default function NoteForm({ srn }: { srn: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr("");
    setBusy(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ srn, text, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(j.error ?? "Could not save the note");
      return;
    }
    setText("");
    setTags("");
    router.refresh();
  }

  const input =
    "w-full rounded border border-line bg-white px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ink";

  return (
    <div className="space-y-2">
      <textarea className={input} rows={3} placeholder="What did you discuss with the student?" value={text} onChange={(e) => setText(e.target.value)} />
      <input className={input} placeholder="Tags, comma separated (attendance, marks, personal)" value={tags} onChange={(e) => setTags(e.target.value)} />
      {err && <p role="alert" className="text-sm text-risk-high">{err}</p>}
      <button
        onClick={submit}
        disabled={busy || !text.trim()}
        className="rounded bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save note"}
      </button>
    </div>
  );
}
