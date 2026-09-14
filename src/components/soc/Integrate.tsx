"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DecisionBadge } from "@/components/DecisionBadge";
import { Tag } from "@/components/ui/States";
import { Panel } from "./Panel";
import { CodeBlock, LangSwitch, type Lang } from "./IntegrateCode";

const DEFAULT_BASE = "https://agentshield-lyart.vercel.app";

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

const CURL_RESPONSE = `{
  "id": "fdc82398-3975-400d-aad3-da36c7ac0f72",
  "decision": "ALLOW",
  "status": "final",
  "operator_summary": "Cleared: trader-alpha may sign. Intent, provenance and on-chain evidence are consistent.",
  ...
}`;

const INSTALL: Record<Lang, string> = {
  python: "pip install ./sdk/python",
  typescript: "npm install ./sdk/typescript",
};

function quickstart(lang: Lang, base: string) {
  if (lang === "python") {
    return `from agentshield import Shield, Blocked, ShieldUnavailable, request_from_tx

shield = Shield("${base}", mode="fast", fail_closed=True)

tx = {"to": router, "value": 0, "data": calldata, "chainId": 8453}
req = request_from_tx(
    tx,
    intent="Approve the DEX router so I can swap 250 USDC",
    sources=[tool_output],  # what the agent read
    agent_id="desk-rebalancer-02",
    method="approve",
)

try:
    tx_hash = shield.guard(req, lambda _: w3.eth.send_transaction(tx))
except Blocked as e:  # BLOCK, or an operator denied it
    log.warning("not signed: %s", e.verdict.operator_summary)
except ShieldUnavailable:
    log.error("shield unreachable, not signed")`;
  }
  return `import { Shield, BlockedError, ShieldUnavailableError, fromViemTx } from "@agentshield/sdk";

const shield = new Shield({ baseUrl: "${base}", mode: "fast", failClosed: true });

const tx = { to: router, value: 0n, data: calldata, chainId: 8453 };
const request = fromViemTx(tx, {
  intent: "Approve the DEX router so I can swap 250 USDC",
  sources: [toolOutput], // what the agent read
  agentId: "desk-rebalancer-02",
  method: "approve",
});

try {
  const hash = await shield.guard(request, () => walletClient.sendTransaction(tx));
} catch (err) {
  if (err instanceof BlockedError) console.warn("not signed:", err.verdict.operator_summary);
  else if (err instanceof ShieldUnavailableError) console.error("shield unreachable, not signed");
  else throw err;
}`;
}

function curlSnippet(base: string) {
  const body = JSON.stringify({ action: "shield", mode: "fast", request: A5_REQUEST }, null, 2);
  return `curl -s -X POST ${base}/api/rpc \\
  -H 'Content-Type: application/json' \\
  -d '${body}'`;
}

function x402Snippet(base: string) {
  return `import { Shield } from "@agentshield/sdk";
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

// Burner wallet holding free testnet USDC on Base Sepolia
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as Hex);
const payingFetch = wrapFetchWithPayment(fetch, account, 20_000n); // pay at most $0.02 per call

const shield = new Shield({ baseUrl: "${base}", mode: "fast", paid: true, fetch: payingFetch });
const verdict = await shield.check(request); // settles $0.001 in USDC, then returns the verdict`;
}

const ERRORS: Record<Lang, { blocked: string; denied: string; timeout: string; down: string }> = {
  python: { blocked: "Blocked", denied: "Denied", timeout: "ReviewTimeout", down: "ShieldUnavailable" },
  typescript: { blocked: "BlockedError", denied: "DeniedError", timeout: "ReviewTimeoutError", down: "ShieldUnavailableError" },
};

function Mono({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[12.5px] text-ink">{children}</code>;
}

export function Integrate() {
  const [base, setBase] = useState(DEFAULT_BASE);
  const [lang, setLang] = useState<Lang>("python");

  useEffect(() => {
    setBase(window.location.origin);
  }, []);

  const err = ERRORS[lang];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Add AgentShield between your agent and its signer.</h2>
          <p className="mt-1 text-[13px] text-mute">
            The SDK sends the transaction, the human&apos;s intent and what the agent read. Your signer only runs when the verdict
            allows it, and nothing is signed if the shield can&apos;t be reached.
          </p>
        </div>
        <LangSwitch lang={lang} onChange={setLang} />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="min-w-0 space-y-3">
          <Panel label="Install" meta={[lang === "python" ? "Python 3.10+, depends on httpx" : "Node 18+, no runtime dependencies"]} bodyClassName="space-y-2 p-4">
            <CodeBlock code={INSTALL[lang]} label="install command" />
            <p className="text-xs text-faint">From the repository. The packages are not published to PyPI or npm yet.</p>
          </Panel>

          <Panel label="Decision contract" meta={["What guard() does"]}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-xs text-faint">
                    <th className="w-36 px-4 py-2 font-normal">Verdict</th>
                    <th className="px-4 py-2 font-normal">Your agent</th>
                    <th className="px-4 py-2 font-normal">You</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr>
                    <td className="px-4 py-3 align-top"><DecisionBadge decision="ALLOW" /></td>
                    <td className="px-4 py-3 text-ink">Calls your signer and returns its result.</td>
                    <td className="px-4 py-3 text-mute">Nothing. The check is recorded.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 align-top"><DecisionBadge decision="BLOCK" /></td>
                    <td className="px-4 py-3 text-ink">
                      Raises <Mono>{err.blocked}</Mono>. The signer never runs.
                    </td>
                    <td className="px-4 py-3 text-mute">Paged with the evidence and trace.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 align-top"><DecisionBadge decision="QUARANTINE" /></td>
                    <td className="px-4 py-3 text-ink">
                      Waits for an operator, then signs or raises <Mono>{err.denied}</Mono>. Gives up with <Mono>{err.timeout}</Mono>.
                    </td>
                    <td className="px-4 py-3 text-mute">Approve or deny in the Review queue.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 align-top"><Tag>Unreachable</Tag></td>
                    <td className="px-4 py-3 text-ink">
                      Raises <Mono>{err.down}</Mono> and fails closed.
                    </td>
                    <td className="px-4 py-3 text-mute">Check the agent status in the console.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <Panel label="Quickstart" meta={[lang === "python" ? "web3.py signer" : "viem wallet client"]} bodyClassName="p-4" className="min-w-0">
          <CodeBlock code={quickstart(lang, base)} label="quickstart code" />
        </Panel>
      </div>

      <Panel label="Raw HTTP" meta={["Free, POST /api/rpc"]} bodyClassName="space-y-3 p-4">
        <p className="text-[13px] text-mute">No SDK? Call the route directly and sign only when the decision is ALLOW.</p>
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <CodeBlock code={curlSnippet(base)} label="curl request" />
          <CodeBlock code={CURL_RESPONSE} label="response" />
        </div>
      </Panel>

      <Panel label="Pay per check with x402" meta={["USDC on Base Sepolia"]} bodyClassName="grid gap-4 p-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-3">
          <p className="text-[13px] text-mute">
            External agents can pay per check instead of using the free route. No account or API key: an unpaid request gets
            HTTP 402 with the price, and the settlement receipt comes back in the <Mono>X-PAYMENT-RESPONSE</Mono> header.
          </p>
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[320px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-xs text-faint">
                  <th className="px-3 py-2 font-normal">Endpoint</th>
                  <th className="px-3 py-2 font-normal">Price</th>
                  <th className="px-3 py-2 font-normal">Runs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr>
                  <td className="px-3 py-2"><Mono>/api/v1/shield</Mono></td>
                  <td className="px-3 py-2 font-mono tabular-nums text-ink">$0.001</td>
                  <td className="px-3 py-2 text-mute">Fast mode</td>
                </tr>
                <tr>
                  <td className="px-3 py-2"><Mono>/api/v1/shield/agent</Mono></td>
                  <td className="px-3 py-2 font-mono tabular-nums text-ink">$0.01</td>
                  <td className="px-3 py-2 text-mute">Agent mode</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-faint">
            Uses free testnet USDC. The TypeScript client takes any fetch, so wrap it with x402-fetch. The Python client does not
            support x402 yet.
          </p>
        </div>
        <CodeBlock code={x402Snippet(base)} label="x402 example" />
      </Panel>
    </div>
  );
}
