import "server-only";
import { randomUUID } from "node:crypto";
import type { Offline } from "./types";

const TIMEOUT_MS = 90_000;

function offline(err: unknown): Offline {
  const msg = err instanceof Error ? err.message : String(err);
  return { error: msg || "agent unreachable", offline: true };
}

async function viaAgentCore(arn: string, payload: object): Promise<unknown> {
  const { BedrockAgentCoreClient, InvokeAgentRuntimeCommand } = await import(
    "@aws-sdk/client-bedrock-agentcore"
  );
  const client = new BedrockAgentCoreClient({ region: process.env.AWS_REGION || "us-west-2" });
  // AgentCore requires session ids >= 33 chars; uuid (36) satisfies it.
  const runtimeSessionId = `agentshield-${randomUUID()}`;
  const res = await client.send(
    new InvokeAgentRuntimeCommand({
      agentRuntimeArn: arn,
      runtimeSessionId,
      payload: new TextEncoder().encode(JSON.stringify(payload)),
      contentType: "application/json",
      accept: "application/json",
    }),
    { abortSignal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (!res.response) throw new Error("AgentCore returned an empty response");
  const text = await res.response.transformToString();
  return JSON.parse(text);
}

async function viaHttp(payload: object): Promise<unknown> {
  const base = (process.env.AGENT_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const res = await fetch(`${base}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`agent returned non-JSON (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const detail =
      (data as { error?: string; detail?: string })?.error ??
      (data as { detail?: string })?.detail ??
      `HTTP ${res.status}`;
    // A 4xx with a structured body is a real answer (e.g. unknown verdict id), not an outage.
    if (res.status >= 500) throw new Error(String(detail));
    return { error: String(detail) };
  }
  return data;
}

/** Server-only bridge to the AgentShield agent (AgentCore runtime, local FastAPI, or dev mock). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function callBackend(action: string, body: object): Promise<any> {
  const payload = { ...body, action };
  try {
    if (process.env.MOCK_BACKEND === "1") {
      const { mockRpc } = await import("./mock");
      return await mockRpc(action, body as Record<string, unknown>);
    }
    const arn = process.env.AGENTCORE_RUNTIME_ARN;
    if (arn) return await viaAgentCore(arn, payload);
    return await viaHttp(payload);
  } catch (err) {
    return offline(err);
  }
}
