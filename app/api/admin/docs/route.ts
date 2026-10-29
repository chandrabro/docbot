import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request body limit is ~4.5 MB

async function clearCache() {
  await db().from("answer_cache").delete().neq("key", "");
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await db()
    .from("documents")
    .select("id, title, char_count, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ docs: data });
}

export async function POST(req: NextRequest) {
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await clearCache();
  return NextResponse.json({ ok: true, chars: content.length });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await db().from("documents").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await clearCache();
  return NextResponse.json({ ok: true });
}
