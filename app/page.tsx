"use client";
import { useState, FormEvent } from "react";

type Item = { q: string; a?: string; source?: string | null; error?: string };

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(e: FormEvent) {
    e.preventDefault();
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setQ("");
    const idx = items.length;
    setItems((prev) => [...prev, { q: question }]);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      setItems((prev) =>
        prev.map((it, i) =>
          i === idx
            ? res.ok
              ? { ...it, a: data.answer, source: data.source }
              : { ...it, error: data.error || "Something went wrong." }
            : it
        )
      );
    } catch {
      setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, error: "Network error. Try again." } : it)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <h1>Ask the Documents</h1>
      <p className="sub">Answers come only from our uploaded documents. If it isn&apos;t there, you&apos;ll hear &ldquo;I don&apos;t know&rdquo;.</p>

      {items.map((it, i) => (
        <div className="card" key={i}>
          <p className="msg-q">{it.q}</p>
          {it.a === undefined && !it.error && <p className="msg-a">Thinking…</p>}
          {it.a !== undefined && <p className="msg-a">{it.a}</p>}
          {it.error && <p className="msg-a err">{it.error}</p>}
          {it.source && <div className="src">From the documents: &ldquo;{it.source}&rdquo;</div>}
        </div>
      ))}

      <form className="ask" onSubmit={ask}>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type your question…" maxLength={500} aria-label="Your question" />
        <button type="submit" disabled={busy || !q.trim()}>Ask</button>
      </form>
    </main>
  );
}
