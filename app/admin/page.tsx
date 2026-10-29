"use client";
import { useEffect, useState, FormEvent } from "react";

type Doc = { id: string; title: string; char_count: number; created_at: string };

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function loadDocs() {
    const res = await fetch("/api/admin/docs");
    if (res.ok) setDocs((await res.json()).docs);
  }

  useEffect(() => {
    fetch("/api/admin/login")
      .then((r) => r.json())
      .then((d) => {
        setAuthed(d.admin);
        if (d.admin) loadDocs();
      })
      .catch(() => setAuthed(false));
  }, []);

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoginErr("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuthed(true);
      setPassword("");
      loadDocs();
    } else {
      const d = await res.json().catch(() => ({}));
      setLoginErr(res.status === 401 ? "Wrong password" : d.error || "Server error. Check your Vercel environment variables.");
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    setAuthed(false);
  }

  async function upload(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const form = new FormData();
    form.set("title", title);
    form.set("text", text);
    if (file) form.set("file", file);
    const res = await fetch("/api/admin/docs", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok && !data.error) {
      data.error =
        res.status === 413
          ? "File is too large for Vercel (limit about 4.5 MB). Use a smaller PDF or paste the text."
          : `Upload failed (server returned ${res.status}). Check Vercel -> Logs for details.`;
    }
    if (res.ok) {
      setMsg({ ok: true, text: `Saved (${data.chars.toLocaleString()} characters).` });
      setTitle(""); setText(""); setFile(null);
      (document.getElementById("file") as HTMLInputElement | null)?.value && ((document.getElementById("file") as HTMLInputElement).value = "");
      loadDocs();
    } else {
      setMsg({ ok: false, text: data.error || "Upload failed." });
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/admin/docs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    loadDocs();
  }

  if (authed === null) return <main className="wrap"><p className="sub">Loading…</p></main>;

  if (!authed) {
    return (
      <main className="wrap">
        <h1>Admin login</h1>
        <form className="card" onSubmit={login}>
          <label htmlFor="pw">Password</label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          {loginErr && <p className="err">{loginErr}</p>}
          <p><button type="submit" disabled={!password}>Log in</button></p>
        </form>
      </main>
    );
  }

  const total = docs.reduce((s, d) => s + d.char_count, 0);

  return (
    <main className="wrap">
      <div className="top">
        <h1>Admin</h1>
        <button className="ghost" onClick={logout}>Log out</button>
      </div>
      <p className="sub">Upload a PDF/TXT/MD file or paste text. Users can then ask questions about it.</p>

      <form className="card" onSubmit={upload}>
        <label htmlFor="title">Title (optional)</label>
        <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label htmlFor="file">File (PDF, TXT, MD — up to 4 MB)</label>
        <input id="file" type="file" accept=".pdf,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <label htmlFor="text">…or paste text</label>
        <textarea id="text" value={text} onChange={(e) => setText(e.target.value)} />
        {msg && <p className={msg.ok ? "ok" : "err"}>{msg.text}</p>}
        <p><button type="submit" disabled={busy || (!file && !text.trim())}>{busy ? "Saving…" : "Save document"}</button></p>
      </form>

      <div className="card">
        <strong>Documents ({docs.length})</strong>
        <span className="meta"> · {total.toLocaleString()} characters total</span>
        {docs.length === 0 && <p className="meta">Nothing uploaded yet.</p>}
        {docs.map((d) => (
          <div className="row" key={d.id}>
            <div>
              <div>{d.title}</div>
              <div className="meta">{d.char_count.toLocaleString()} chars · {new Date(d.created_at).toLocaleDateString()}</div>
            </div>
            <button className="danger" onClick={() => remove(d.id)}>Delete</button>
          </div>
        ))}
      </div>
    </main>
  );
}
