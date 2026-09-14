import { NextResponse } from "next/server";

export const runtime = "nodejs";

const AGENT =
  process.env.AGENT_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const res = await fetch(`${AGENT}/shield`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    // UI historically expected the verdict object directly
    return NextResponse.json(data.verdict ?? data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "shield proxy failed";
    return NextResponse.json(
      {
        error: message,
        hint: "Start the Strands agent API: source .venv/bin/activate && python -m agent.server",
      },
      { status: 502 },
    );
  }
}
