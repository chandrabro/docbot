import { NextRequest, NextResponse } from "next/server";
import { checkPassword, endSession, startSession, isAdmin } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ admin: await isAdmin() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  try {
    if (!checkPassword(password)) {
      await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
      return NextResponse.json({ error: "Wrong password" }, { status: 401 });
    }
    await startSession();
    return NextResponse.json({ ok: true });
  } catch (e) {
    // Misconfiguration (missing ADMIN_PASSWORD or SESSION_SECRET too short)
    return NextResponse.json(
      { error: "Server setup problem: " + (e instanceof Error ? e.message : "unknown") },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  await endSession();
  return NextResponse.json({ ok: true });
}
