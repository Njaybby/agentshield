import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BlockedError,
  DeniedError,
  ReviewTimeoutError,
  Shield,
  ShieldError,
  ShieldUnavailableError,
  fromViemTx,
} from "../dist/index.js";

const REQ = {
  agent_id: "desk-01",
  provenance: { user_intent: "Swap 0.05 ETH to USDC", sources: [] },
  proposed_tx: { to: "0x2626664c2603336E57B271c5C0b26F421741e481", value_wei: "50000000000000000", chain_id: 8453 },
};

const verdict = (decision, status, id = "v1") => ({
  id,
  decision,
  status: status ?? (decision === "QUARANTINE" ? "pending_review" : "final"),
  mode: "fast",
  operator_summary: `${decision} summary`,
  latency_ms: 12,
  gate1: { forced_block: decision === "BLOCK", novel_quarantine: false, checks: [] },
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function mockFetch(first, polls = []) {
  const calls = [];
  const fn = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    if (body.action === "telemetry") return json(polls.shift());
    return json(first);
  };
  fn.calls = calls;
  return fn;
}

const shield = (fetch, opts = {}) => new Shield({ baseUrl: "https://shield.test/", fetch, pollEveryMs: 0, ...opts });

test("ALLOW signs", async () => {
  const f = mockFetch(verdict("ALLOW"));
  const signed = [];
  const out = await shield(f).guard(REQ, (tx) => (signed.push(tx), "0xhash"));
  assert.equal(out, "0xhash");
  assert.deepEqual(signed, [REQ.proposed_tx]);
  assert.equal(f.calls[0].url, "https://shield.test/api/rpc");
  assert.deepEqual(f.calls[0].body, { action: "shield", mode: "fast", request: REQ });
});

test("BLOCK throws and does not sign", async () => {
  let signed = false;
  await assert.rejects(
    shield(mockFetch(verdict("BLOCK"))).guard(REQ, () => (signed = true)),
    (err) => err instanceof BlockedError && err.verdict.decision === "BLOCK",
  );
  assert.equal(signed, false);
});

test("QUARANTINE approved signs after polling", async () => {
  const f = mockFetch(verdict("QUARANTINE"), [verdict("QUARANTINE"), verdict("QUARANTINE", "approved")]);
  assert.equal(await shield(f).guard(REQ, () => "signed"), "signed");
  assert.deepEqual(f.calls.map((c) => c.body.action), ["shield", "telemetry", "telemetry"]);
  assert.deepEqual(f.calls[1].body, { action: "telemetry", view: "verdict", id: "v1" });
});

test("QUARANTINE denied throws DeniedError", async () => {
  let signed = false;
  const f = mockFetch(verdict("QUARANTINE"), [verdict("QUARANTINE", "denied")]);
  await assert.rejects(shield(f).guard(REQ, () => (signed = true)), DeniedError);
  assert.equal(signed, false);
});

test("QUARANTINE with no decision in time throws ReviewTimeoutError", async () => {
  const f = mockFetch(verdict("QUARANTINE"), [verdict("QUARANTINE"), verdict("QUARANTINE")]);
  await assert.rejects(shield(f, { maxWaitMs: 0 }).guard(REQ, () => "signed"), ReviewTimeoutError);
});

test("unreachable fails closed", async () => {
  let signed = false;
  const down = async () => {
    throw new TypeError("fetch failed");
  };
  await assert.rejects(shield(down).guard(REQ, () => (signed = true)), ShieldUnavailableError);
  assert.equal(signed, false);
});

test("failClosed: false signs when unreachable", async () => {
  const down = async () => {
    throw new TypeError("fetch failed");
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await shield(down, { failClosed: false }).guard(REQ, () => "signed"), "signed");
  } finally {
    console.warn = warn;
  }
});

test("429 and offline bodies are unavailable", async () => {
  await assert.rejects(shield(async () => json({ error: "rate limited" }, 429)).check(REQ), ShieldUnavailableError);
  await assert.rejects(shield(async () => json({ error: "down", offline: true }, 503)).check(REQ), ShieldUnavailableError);
  await assert.rejects(shield(async () => new Response("<html>", { status: 502 })).check(REQ), ShieldUnavailableError);
});

test("bad request never fails open", async () => {
  const bad = async () => json({ error: "body.request with proposed_tx and provenance is required" });
  await assert.rejects(
    shield(bad, { failClosed: false }).guard(REQ, () => "signed"),
    (err) => err instanceof ShieldError && !(err instanceof ShieldUnavailableError),
  );
});

test("paid mode posts a bare request to the x402 endpoints", async () => {
  const f = mockFetch(verdict("ALLOW"));
  const s = shield(f, { paid: true });
  await s.check(REQ);
  await s.check(REQ, "agent");
  assert.deepEqual(f.calls.map((c) => c.url), ["https://shield.test/api/v1/shield", "https://shield.test/api/v1/shield/agent"]);
  assert.deepEqual(f.calls[0].body, REQ);
});

test("402 without a paying fetch is a ShieldError", async () => {
  const s = shield(async () => json({ x402Version: 1, error: "X-PAYMENT header is required" }, 402), { paid: true, failClosed: false });
  await assert.rejects(
    s.guard(REQ, () => "signed"),
    (err) => err instanceof ShieldError && !(err instanceof ShieldUnavailableError),
  );
});

test("fromViemTx", () => {
  const req = fromViemTx(
    { to: "0xabc", value: 10n ** 18n, data: "0x095ea7b3", chainId: 8453 },
    { intent: "Approve the router", sources: ["tool said approve", { type: "web", content: "docs", url: "https://x" }], agentId: "bot-7", method: "approve" },
  );
  assert.deepEqual(req, {
    agent_id: "bot-7",
    provenance: {
      user_intent: "Approve the router",
      sources: [{ type: "text", content: "tool said approve" }, { type: "web", content: "docs", url: "https://x" }],
    },
    proposed_tx: { to: "0xabc", value_wei: "1000000000000000000", chain_id: 8453, data: "0x095ea7b3", method: "approve" },
  });
  assert.equal(fromViemTx({ to: "0xabc", value: "0x10", data: "0x" }, { intent: "x", chainId: 1 }).proposed_tx.value_wei, "16");
  assert.throws(() => fromViemTx({ to: "0xabc" }, { intent: "x" }), /chainId/);
});
