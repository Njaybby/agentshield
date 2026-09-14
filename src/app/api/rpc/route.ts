import { NextResponse } from "next/server";
import { callBackend } from "@/lib/backend";
import { RPC_ACTIONS, isOffline, type RpcAction } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Agent mode spends model tokens on every run, so the public demo caps it per client.
// Best-effort per-instance limiter; fast mode stays unlimited.
const AGENT_RUNS_PER_WINDOW = Number(process.env.AGENT_RUNS_PER_WINDOW ?? 8);
const WINDOW_MS = 10 * 60 * 1000;
const agentRuns = new Map<string, number[]>();

function agentRunAllowed(ip: string): boolean {
  const now = Date.now();
  const recent = (agentRuns.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= AGENT_RUNS_PER_WINDOW) {
    agentRuns.set(ip, recent);
    return false;
  }
  recent.push(now);
  agentRuns.set(ip, recent);
  return true;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const action = body?.action;
  if (typeof action !== "string" || !RPC_ACTIONS.includes(action as RpcAction)) {
    return NextResponse.json(
      { error: `action must be one of: ${RPC_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }
  if (body.mode === "agent" && (action === "shield" || action === "attack")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!agentRunAllowed(ip)) {
      return NextResponse.json(
        { error: "Agent mode is rate limited on the public demo (8 runs per 10 minutes). Fast mode is unlimited." },
        { status: 429 },
      );
    }
  }
  const { action: _omit, ...rest } = body;
  void _omit;
  const data = await callBackend(action, rest);
  // Offline bodies are typed ({error, offline:true}); the UI renders them as RECORDER OFFLINE.
  return NextResponse.json(data, { status: isOffline(data) ? 503 : 200 });
}
