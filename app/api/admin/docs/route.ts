import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is ~4.5 MB

async function clearCache() {
  await db().from("answer_cache").delete().neq("key", "");
}

async function handleGET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await db()
    .from("documents")
    .select("id, title, char_count, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return NextResponse.json({ docs: data });
}

async function handlePOST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const pasted = String(form.get("text") || "").trim();
  const file = form.get("file");
  let title = String(form.get("title") || "").trim();
  let content = pasted;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File is over 4 MB. Split it or compress it." }, { status: 413 });
    }
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) {
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
      const { text } = await extractText(pdf, { mergePages: true });
      content = text.trim();
    } else if (name.endsWith(".txt") || name.endsWith(".md")) {
      content = (await file.text()).trim();
    } else {
      return NextResponse.json({ error: "Only PDF, TXT or MD files are supported." }, { status: 400 });
    }
    if (!title) title = file.name.replace(/\.[^.]+$/, "");
  }

  if (!content || content.length < 20) {
    return NextResponse.json(
      { error: "No readable text found. If this is a scanned PDF (images only), paste the text instead." },
      { status: 400 }
    );
  }
  if (!title) title = "Untitled";

  const { error } = await db()
    .from("documents")
    .insert({ title, content, char_count: content.length });
  if (error) throw new Error(error.message);
  await clearCache();
  return NextResponse.json({ ok: true, chars: content.length });
}

async function handleDELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await db().from("documents").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await clearCache();
  return NextResponse.json({ ok: true });
}

function fail(e: unknown) {
  console.error(e);
  const msg = e instanceof Error ? e.message : "Unknown error";
  const hint = /SUPABASE/i.test(msg)
    ? " (add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel, then redeploy)"
    : /relation .* does not exist|schema cache/i.test(msg)
    ? " (run supabase/schema.sql in the Supabase SQL Editor)"
    : /invalid api key|jwt/i.test(msg)
    ? " (check SUPABASE_SERVICE_ROLE_KEY)"
    : "";
  return NextResponse.json({ error: "Server error: " + msg + hint }, { status: 500 });
}

export async function GET() {
  try { return await handleGET(); } catch (e) { return fail(e); }
}
export async function POST(req: NextRequest) {
  try { return await handlePOST(req); } catch (e) { return fail(e); }
}
export async function DELETE(req: NextRequest) {
  try { return await handleDELETE(req); } catch (e) { return fail(e); }
}
