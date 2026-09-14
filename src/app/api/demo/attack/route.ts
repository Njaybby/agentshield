import { NextResponse } from "next/server";

export const runtime = "nodejs";

const AGENT =
  process.env.AGENT_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export async function GET() {
  try {
    const res = await fetch(`${AGENT}/scenarios`, { cache: "no-store" });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "proxy failed";
    return NextResponse.json({ error: message, attacks: [] }, { status: 502 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${AGENT}/demo/attack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "attack proxy failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
