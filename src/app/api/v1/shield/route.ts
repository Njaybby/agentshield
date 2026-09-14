import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { callBackend } from "@/lib/backend";
import { isOffline, type Mode, type ShieldRequest } from "@/lib/types";

// Third-party, pay-per-call entry point for AgentShield: any trading agent can
// POST here (no API key, no account) after paying via x402 (see src/middleware.ts).
// Internal UI traffic keeps using /api/rpc -> callBackend, unmetered.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isProposedTx(x: unknown): x is ShieldRequest["proposed_tx"] {
  if (!x || typeof x !== "object") return false;
  const tx = x as Record<string, unknown>;
  return (
    typeof tx.to === "string" &&
    typeof tx.value_wei === "string" &&
    typeof tx.chain_id === "number"
  );
}

function isShieldRequest(x: unknown): x is ShieldRequest {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  if (typeof r.agent_id !== "string" || r.agent_id.length === 0) return false;
  const provenance = r.provenance as Record<string, unknown> | undefined;
  if (
    !provenance ||
    typeof provenance.user_intent !== "string" ||
    !Array.isArray(provenance.sources)
  ) {
    return false;
  }
  return isProposedTx(r.proposed_tx);
}

/**
 * Accepts either the bare backend contract `ShieldRequest`, or the UI-style
 * envelope `{ request: ShieldRequest, mode }`, so third-party agents don't
 * need to know about AgentShield's internal RPC shape.
 */
function extractRequest(body: unknown): unknown {
  if (body && typeof body === "object" && "request" in (body as Record<string, unknown>)) {
    return (body as { request: unknown }).request;
  }
  return body;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const request = extractRequest(body);
  if (!isShieldRequest(request)) {
    return NextResponse.json(
      {
        error:
          "body must be a ShieldRequest ({agent_id, provenance:{user_intent,sources[]}, " +
          "proposed_tx:{to,value_wei,chain_id,...}}), sent either bare or as {request, mode}.",
      },
      { status: 400 },
    );
  }

  // Mode: explicit body.mode wins; otherwise the middleware tags requests that
  // paid the $0.01 agent-mode price (via POST /api/v1/shield/agent) with a
  // header before rewriting them here; default is the $0.001 fast-mode price.
  const bodyMode = (body as { mode?: unknown } | null)?.mode;
  const headerMode = req.headers.get("x-agentshield-mode");
  const mode: Mode = bodyMode === "agent" || headerMode === "agent" ? "agent" : "fast";

  const verdict = await callBackend("shield", { request, mode });
  return NextResponse.json(verdict, { status: isOffline(verdict) ? 503 : 200 });
}
