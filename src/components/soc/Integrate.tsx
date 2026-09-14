"use client";

import { useState } from "react";
import { DecisionBadge } from "@/components/DecisionBadge";
import { Panel } from "./Panel";

// Minimal real request: the A5 clean Uniswap swap on Base mainnet.
const A5_REQUEST = {
  agent_id: "trader-alpha",
  provenance: {
    user_intent: "Swap 0.05 ETH to USDC on Uniswap",
    sources: [{ type: "web", url: "https://app.uniswap.org", content: "Uniswap V3 ETH/USDC pool, 0.05% fee tier on Base." }],
  },
  proposed_tx: {
    to: "0x6fF5693b99212Da76ad316178A184AB56D299b43",
    value_wei: "50000000000000000",
    chain_id: 8453,
    method: "execute",
    token_symbol: "USDC",
  },
};

function curlSnippet(base: string) {
  const body = JSON.stringify({ action: "shield", mode: "fast", request: A5_REQUEST }, null, 2);
  return `curl -s -X POST ${base}/api/rpc \\
  -H 'Content-Type: application/json' \\
  -d '${body}'`;
}

const CURL_RESPONSE = `{
  "id": "fdc82398-3975-400d-aad3-da36c7ac0f72",
  "decision": "ALLOW",
  "status": "final",
  "operator_summary": "Cleared: trader-alpha may sign. Intent, provenance and on-chain evidence are consistent.",
  ...
}`;

function pythonSnippet(base: string) {
  return `import time, requests

SHIELD = "${base}/api/rpc"

class ShieldBlocked(Exception):
    pass

def _rpc(payload):
    r = requests.post(SHIELD, json=payload, timeout=90)  # agent mode takes 10-40s
    r.raise_for_status()
    body = r.json()
    if body.get("error"):
        raise ShieldBlocked(f"shield unavailable, failing closed: {body['error']}")
    return body

def guard_then_sign(request, sign_fn, poll_every=5, max_wait=1800):
    v = _rpc({"action": "shield", "mode": "agent", "request": request})
    deadline = time.time() + max_wait
    while v["status"] == "pending_review":            # QUARANTINE: operator decides
        if time.time() > deadline:
            raise ShieldBlocked(f"{v['id']}: no operator decision in time")
        time.sleep(poll_every)
        v = _rpc({"action": "telemetry", "view": "verdict", "id": v["id"]})
    if v["status"] == "approved" or (v["decision"] == "ALLOW" and v["status"] == "final"):
        return sign_fn(request["proposed_tx"])
    raise ShieldBlocked(f"{v['decision']}/{v['status']} {v['id']}: {v['operator_summary']}")`;
}

function x402Snippet(base: string) {
  return `// npm i x402-fetch viem
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

// Burner wallet holding free testnet USDC on Base Sepolia
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const payFetch = wrapFetchWithPayment(fetch, account);

// ${base}/api/v1/shield        $0.001  fast (deterministic gates)
// ${base}/api/v1/shield/agent  $0.01   agent mode (Strands + LLM review)
const res = await payFetch("${base}/api/v1/shield", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(request), // a bare ShieldRequest
});

const verdict = await res.json();
const receipt = decodeXPaymentResponse(res.headers.get("x-payment-response"));
console.log(verdict.decision, verdict.id, "settled in tx", receipt.transaction);`;
}

function CodePanel({ code, label, meta, snippet }: { code: string; label: string; meta: string[]; snippet: string }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    window.setTimeout(() => setCopied(null), 1600);
  };
  return (
    <Panel
      code={code}
      label={label}
      meta={meta}
      className="min-w-0"
      right={
        <button
          type="button"
          onClick={copy}
          className={`border px-2 py-0.5 font-mono text-[10px] tracking-wider ${
            copied === "ok" ? "border-allow/60 text-allow" : copied === "fail" ? "border-block/60 text-block" : "border-line-strong text-mute hover:text-ink"
          }`}
        >
          {copied === "ok" ? "COPIED" : copied === "fail" ? "COPY FAILED" : "COPY"}
        </button>
      }
    >
      <pre className="overflow-x-auto bg-canvas p-4 font-mono text-[12px] leading-5 text-[#d4d4d4]">{snippet}</pre>
    </Panel>
  );
}

export function Integrate() {
  const [base] = useState(() => (typeof window !== "undefined" ? window.location.origin : "https://agentshield.example"));

  return (
    <div className="space-y-3">
      <Panel code="FDR-70" label="INTEGRATE" meta={["PRE-SIGN HOOK", base.replace(/^https?:\/\//, "")]} bodyClassName="px-4 py-3">
        <p className="max-w-3xl text-sm text-mute">
          Call AgentShield between &ldquo;the agent decided&rdquo; and &ldquo;the wallet signed&rdquo;. Send the transaction and the
          provenance the agent acted on. Clear cases come back resolved. Judgment calls wait in your Review Queue. If the
          shield is unreachable, fail closed.
        </p>
      </Panel>

      <Panel code="FDR-71" label="DECISION CONTRACT" meta={["WHAT YOUR SIGNER DOES"]}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="terminal-header">
              <tr className="border-b border-line">
                <th className="w-40 px-4 py-2 font-normal">decision</th>
                <th className="px-4 py-2 font-normal">your agent</th>
                <th className="px-4 py-2 font-normal">you</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="px-4 py-3"><DecisionBadge decision="ALLOW" size="md" /></td>
                <td className="px-4 py-3 text-ink">Sign and broadcast.</td>
                <td className="px-4 py-3 text-mute">Nothing. Logged to the recorder.</td>
              </tr>
              <tr className="border-b border-line">
                <td className="px-4 py-3"><DecisionBadge decision="BLOCK" size="md" /></td>
                <td className="px-4 py-3 text-ink">Discard the transaction. Never retry it as-is.</td>
                <td className="px-4 py-3 text-mute">Already paged, with the evidence and full trace.</td>
              </tr>
              <tr>
                <td className="px-4 py-3"><DecisionBadge decision="QUARANTINE" size="md" /></td>
                <td className="px-4 py-3 text-ink">Hold. Poll the verdict until it is <span className="font-mono text-[13px]">approved</span> or <span className="font-mono text-[13px]">denied</span>.</td>
                <td className="px-4 py-3 text-mute">Approve or deny in the Review Queue.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
        <CodePanel code="FDR-72" label="CURL" meta={["FREE", "POST /api/rpc", "FAST MODE"]} snippet={curlSnippet(base)} />
        <CodePanel code="FDR-73" label="RESPONSE" meta={["EXCERPT", "VERDICT"]} snippet={CURL_RESPONSE} />
      </div>

      <CodePanel code="FDR-74" label="PYTHON · SIGNER GUARD" meta={["REQUESTS", "AGENT MODE", "guard_then_sign()"]} snippet={pythonSnippet(base)} />

      <CodePanel code="FDR-75" label="NODE · X402 PAY-PER-CHECK" meta={["NO ACCOUNT", "USDC · BASE SEPOLIA 84532"]} snippet={x402Snippet(base)} />
      <div className="border border-line bg-panel px-4 py-3 text-sm text-mute">
        <span className="terminal-header mr-2 !text-ink">note</span>
        This is optional, for external agents with no account. They pay per check over x402 using{" "}
        <span className="text-ink">free testnet USDC</span> on Base Sepolia. An unpaid request gets HTTP 402 with the price.
        The settlement receipt comes back in the <span className="font-mono text-[13px]">X-PAYMENT-RESPONSE</span> header.
        This console and <span className="font-mono text-[13px]">/api/rpc</span> are free.
      </div>
    </div>
  );
}
