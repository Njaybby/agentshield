import { NextResponse } from "next/server";

export const runtime = "nodejs";

const AGENT =
  process.env.AGENT_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "overview";
    const res = await fetch(`${AGENT}/telemetry?view=${encodeURIComponent(view)}`, {
      cache: "no-store",
    });
    const data = await res.json();
    // Flight Recorder expects telemetry array; provide empty if absent
    if (view === "overview" && !data.telemetry) {
      data.telemetry = (data.latest ?? []).map(
        (v: { id: string; ts: string; decision: string; agent_id: string }) => ({
          id: `tel-${v.id}`,
          ts: v.ts,
          kind: "verdict",
          payload: { decision: v.decision, agent_id: v.agent_id },
        }),
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "telemetry proxy failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
