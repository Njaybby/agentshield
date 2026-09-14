import { NextResponse } from "next/server";

export const runtime = "nodejs";

const AGENT =
  process.env.AGENT_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

/** Invoke the Strands Agents SDK loop with a natural-language prompt. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${AGENT}/agent/invoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "agent proxy failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  try {
    const res = await fetch(`${AGENT}/health`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "agent health failed";
    return NextResponse.json(
      { ok: false, error: message, strands_ready: false },
      { status: 502 },
    );
  }
}
