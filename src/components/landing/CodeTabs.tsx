"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

const SNIPPETS = {
  Python: {
    install: "pip install ./sdk/python",
    code: `from agentshield import Shield, Blocked, ShieldUnavailable, request_from_tx

shield = Shield("https://agentshield-lyart.vercel.app", mode="agent")

req = request_from_tx(
    tx,
    intent="Approve the DEX router so I can swap 250 USDC",
    sources=[tool_output],  # what the agent read
    agent_id="desk-rebalancer-02",
)

try:
    tx_hash = shield.guard(req, lambda _: w3.eth.send_transaction(tx))
except Blocked as e:
    log.warning("not signed: %s", e.verdict.operator_summary)
except ShieldUnavailable:
    log.error("shield unreachable, not signed")`,
  },
  TypeScript: {
    install: "npm install ./sdk/typescript",
    code: `import { Shield, BlockedError, fromViemTx } from "@agentshield/sdk";

const shield = new Shield({ baseUrl: "https://agentshield-lyart.vercel.app", mode: "agent" });

const request = fromViemTx(tx, {
  intent: "Approve the DEX router so I can swap 250 USDC",
  sources: [toolOutput],
  agentId: "desk-rebalancer-02",
});

try {
  const hash = await shield.guard(request, () => walletClient.sendTransaction(tx));
} catch (err) {
  if (err instanceof BlockedError) console.warn("not signed:", err.verdict.operator_summary);
  else throw err; // ShieldUnavailableError: fail closed
}`,
  },
} as const;

type Lang = keyof typeof SNIPPETS;

export function CodeTabs() {
  const [lang, setLang] = useState<Lang>("Python");
  const [copied, setCopied] = useState(false);
  const s = SNIPPETS[lang];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${s.install}\n\n${s.code}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-[14px] border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-2">
        <div role="tablist" aria-label="SDK language" className="flex">
          {(Object.keys(SNIPPETS) as Lang[]).map((l) => (
            <button
              key={l}
              role="tab"
              aria-selected={lang === l}
              onClick={() => setLang(l)}
              className={`relative px-3 py-2.5 text-[13px] transition-colors ${lang === l ? "text-ink" : "text-faint hover:text-mute"}`}
            >
              {l}
              {lang === l && <span className="absolute inset-x-3 -bottom-px h-px bg-ink" />}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-faint transition-colors hover:text-ink"
          aria-live="polite"
        >
          {copied ? <Check size={14} className="text-allow" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="border-b border-line px-4 py-2.5 font-mono text-[12.5px] text-mute">
        <span className="select-none text-faint">$ </span>
        {s.install}
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.7] text-[#d4d4d8]">
        <code>{s.code}</code>
      </pre>
    </div>
  );
}
