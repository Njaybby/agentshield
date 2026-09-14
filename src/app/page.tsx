import Link from "next/link";
import Image from "next/image";
import { Shell } from "@/components/Shell";

const GATES = [
  {
    k: "GATE 1",
    t: "Deterministic choke point",
    d: "Value caps, unlimited-approve and intent/calldata checks, Morse and hidden-instruction scans, eth_call simulation on Base, GoPlus token and address security. A critical failure is a hard BLOCK. No model can argue with it.",
  },
  {
    k: "GATE 2",
    t: "Adversarial sub-agent",
    d: "A separate LLM reviewer sees only the proposed transaction and the provenance the trading agent read, never its chat. It scores hijack likelihood, names the attack class and quotes the evidence.",
  },
  {
    k: "HUMAN",
    t: "Quarantine, not guesswork",
    d: "A clean but first-seen counterparty stops for an operator. They approve or deny with a note, and the decision is written to the recorder alongside the machine's reasoning.",
  },
];

const STACK = [
  ["Strands Agents", "tool-using investigator loop"],
  ["Claude", "orchestrator + isolated reviewer"],
  ["Base", "simulation, calldata decode, code checks"],
  ["GoPlus", "honeypot + malicious address intel"],
  ["ReputationRegistry", "ERC-8004-style IOCs on Base Sepolia"],
  ["x402", "pay-per-check API for external agents"],
  ["ClickHouse", "verdict store, analytics, anomaly z-scores"],
];

export default function HomePage() {
  return (
    <Shell active="home">
      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="absolute inset-0">
            <Image src="/hero-atmosphere.jpg" alt="" fill priority className="object-cover opacity-35" sizes="100vw" />
            <div className="absolute inset-0 bg-gradient-to-b from-canvas/40 via-canvas/85 to-canvas" />
          </div>

          <div className="relative mx-auto grid max-w-[1400px] gap-10 px-4 pb-16 pt-14 md:px-6 md:pb-24 md:pt-20 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
            <div>
              <p className="terminal-header mb-6">pre-trade firewall · autonomous trading agents · base</p>
              <h1 className="display-serif max-w-4xl text-5xl leading-[1.02] text-balance md:text-7xl">
                Stop the agent <span className="accent-crimson">before</span> it signs the{" "}
                <span className="accent-crimson">drain</span>.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-relaxed text-mute md:text-lg">
                Trading agents read token metadata, tool output and the open web, so anything they read can hijack
                them. AgentShield sits between the agent and its wallet. It investigates every proposed transaction
                and answers <span className="text-allow">ALLOW</span>, <span className="text-block">BLOCK</span> or{" "}
                <span className="text-quarantine">QUARANTINE</span> for a human to decide.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/soc" className="btn-crimson px-6 py-3 font-mono text-xs tracking-[0.14em]">
                  OPEN FLIGHT RECORDER ▸
                </Link>
                <Link
                  href="/soc?tab=inspect"
                  className="border border-line-strong px-6 py-3 font-mono text-xs tracking-[0.14em] text-ink hover:bg-elevated"
                >
                  TRY YOUR OWN INJECTION
                </Link>
              </div>
            </div>

            {/* Recorder excerpt */}
            <div className="border border-line bg-canvas/80 backdrop-blur-sm">
              <div className="terminal-header flex justify-between border-b border-line px-3 py-1.5">
                <span>
                  <span className="text-ink">FDR-04</span> · TRACE · CH 8453
                </span>
                <span className="text-block">BLOCK</span>
              </div>
              <ol className="space-y-1.5 px-3 py-3 font-mono text-[11px] leading-5">
                {[
                  ["◇", "request.received", "trader-alpha", "text-mute"],
                  ["⚙", "scan_provenance", "morse payload decoded", "text-block"],
                  ["⚙", "decode_calldata", "transfer(address,uint256)", "text-mute"],
                  ["⚙", "goplus.security", "address flagged", "text-block"],
                  ["⚙", "registry.lookup", "IOC #3 matched", "text-block"],
                  ["▣", "gate1.evaluate", "forced_block=true", "text-block"],
                  ["◈", "gate2.adversarial_review", "hijack 97%", "text-block"],
                  ["◇", "clickhouse.insert", "1 row", "text-mute"],
                ].map(([g, n, o, tone]) => (
                  <li key={n} className="grid grid-cols-[16px_1fr_auto] gap-2">
                    <span className="text-mute">{g}</span>
                    <span className="truncate text-ink">{n}</span>
                    <span className={`truncate ${tone}`}>{o}</span>
                  </li>
                ))}
              </ol>
              <div className="border-t border-line px-3 py-2 text-[11px] text-mute">
                Illustrative trace. Every live verdict in the recorder carries its full step-by-step trace.
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-6 md:py-16">
          <section id="gates" className="grid gap-px border border-line bg-line md:grid-cols-3">
            {GATES.map((c) => (
              <div key={c.k} className="bg-panel p-6">
                <div className="terminal-header text-crimson">{c.k}</div>
                <h2 className="mt-2 text-lg font-medium">{c.t}</h2>
                <p className="mt-2 text-sm leading-relaxed text-mute">{c.d}</p>
              </div>
            ))}
          </section>

          <section className="mt-10 grid gap-6 border border-line bg-panel p-6 md:grid-cols-[1fr_1.1fr] md:items-center md:p-8">
            <div>
              <div className="terminal-header mb-3">integrate</div>
              <h2 className="display-serif text-3xl md:text-4xl">Plug in before you sign.</h2>
              <p className="mt-3 text-sm leading-relaxed text-mute md:text-base">
                One call between your trading agent and its signer. Sign on ALLOW, drop on BLOCK, and wait on
                QUARANTINE until an operator decides. Clear cases resolve themselves. You only get paged for
                judgment calls.
              </p>
              <Link href="/soc?tab=integrate" className="mt-5 inline-block border border-line-strong px-5 py-2.5 font-mono text-xs tracking-[0.14em] text-ink hover:bg-elevated">
                VIEW INTEGRATION SNIPPETS ▸
              </Link>
            </div>
            <pre className="overflow-x-auto border border-line bg-canvas p-4 font-mono text-[11px] leading-5 text-[#c9c9c9]">{`verdict = shield(tx, provenance)

if verdict.decision == "ALLOW":       sign(tx)
elif verdict.decision == "BLOCK":     discard(tx)   # page already sent
else:  # QUARANTINE
    wait_for_operator(verdict.id)     # Review Queue`}</pre>
          </section>

          <section className="mt-10 grid gap-8 border border-line bg-panel p-6 md:p-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="terminal-header mb-3">architecture</div>
              <h2 className="display-serif text-3xl md:text-4xl">Provenance in. Verdict out. Everything recorded.</h2>
              <p className="mt-4 text-sm leading-relaxed text-mute md:text-base">
                The trading agent submits the transaction it wants to sign together with what it read. A Strands agent
                runs the investigation tools, both gates, and writes the verdict and its full tool
                trace to ClickHouse. Threat intel comes from GoPlus and an on-chain reputation registry. External agents
                can pay per check over x402.
              </p>
              <Link href="/soc" className="btn-crimson mt-6 inline-block px-5 py-2.5 font-mono text-xs tracking-[0.14em]">
                RUN THE ATTACK LAB ▸
              </Link>
            </div>
            <ul className="divide-y divide-line border border-line bg-canvas">
              {STACK.map(([name, what]) => (
                <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2.5">
                  <span className="font-mono text-sm text-ink">{name}</span>
                  <span className="text-xs text-mute">{what}</span>
                </li>
              ))}
            </ul>
          </section>

          <footer className="mt-14 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-6">
            <div>
              <div className="display-serif text-2xl">AgentShield</div>
              <div className="mt-1 text-xs text-mute">NOKARA Labs · AWS Agents for Humans · Professional Agents</div>
            </div>
            <Image src="/agentshield-mark.svg" alt="" width={40} height={40} className="opacity-90" />
          </footer>
        </div>
      </main>
    </Shell>
  );
}
