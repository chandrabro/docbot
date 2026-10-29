import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { askLlm } from "@/lib/llm";

export const maxDuration = 60;

const DONT_KNOW = "I don't know. This is not covered in the provided documents.";
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT_PER_USER || 20);
const MAX_QUESTION = 500;
const MAX_CONTEXT_CHARS = 400_000; // ~100k tokens, plenty for ~50 pages

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

async function underDailyLimit(ip: string): Promise<boolean> {
  const supabase = db();
  const day = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("rate_limits")
    .select("count")
    .eq("ip", ip)
    .eq("day", day)
    .maybeSingle();
  const used = data?.count ?? 0;
  if (used >= DAILY_LIMIT) return false;
  await supabase.from("rate_limits").upsert({ ip, day, count: used + 1 });
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) return NextResponse.json({ error: "Please type a question." }, { status: 400 });
    if (question.length > MAX_QUESTION) {
      return NextResponse.json({ error: `Question is too long (max ${MAX_QUESTION} characters).` }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!(await underDailyLimit(ip))) {
      return NextResponse.json(
        { error: `Daily limit reached (${DAILY_LIMIT} questions). Please come back tomorrow.` },
        { status: 429 }
      );
    }

    const supabase = db();

    // Cache: same question => same answer, no API call
    const cacheKey = crypto.createHash("sha256").update(norm(question)).digest("hex");
    const { data: cached } = await supabase
      .from("answer_cache")
      .select("answer")
      .eq("key", cacheKey)
      .maybeSingle();
    if (cached?.answer) return NextResponse.json({ ...cached.answer, cached: true });

    const { data: docs, error } = await supabase
      .from("documents")
      .select("title, content")
      .order("created_at", { ascending: true });
    if (error) throw error;
    if (!docs || docs.length === 0) {
      return NextResponse.json({ answer: DONT_KNOW, source: null });
    }

    let context = docs.map((d) => `### Document: ${d.title}\n${d.content}`).join("\n\n");
    if (context.length > MAX_CONTEXT_CHARS) context = context.slice(0, MAX_CONTEXT_CHARS);

    const result = await askLlm(context, question);

    // Anti-hallucination check: the quoted evidence must really exist in the documents.
    const strict = process.env.STRICT_QUOTE_CHECK !== "false";
    const quoteOk = result.quote && norm(context).includes(norm(result.quote));
    const ok = result.found && result.answer && (!strict || quoteOk);

    const payload = ok
      ? { answer: result.answer, source: result.quote }
      : { answer: DONT_KNOW, source: null };

    await supabase.from("answer_cache").upsert({ key: cacheKey, answer: payload });
    return NextResponse.json(payload);
  } catch (e) {
    console.error(e);
    const status = (e as { status?: number }).status;
    if (status === 429) {
      return NextResponse.json(
        { error: "The AI is busy right now (free limit reached). Please try again in a minute." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
