import Link from "next/link";
import Image from "next/image";
import { Shell } from "@/components/Shell";

export default function HomePage() {
  return (
    <Shell active="home">
      <main>
        {/* Hero — inspo layout: big serif, crimson accents, grain, atmosphere */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="absolute inset-0">
            <Image
              src="/hero-atmosphere.jpg"
              alt=""
              fill
              priority
              className="object-cover opacity-40"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-canvas/40 via-canvas/80 to-canvas" />
          </div>

          <div className="relative mx-auto max-w-[1400px] px-4 pb-16 pt-14 md:px-6 md:pb-24 md:pt-20">
            <p className="terminal-header mb-6">
              nokara labs · agents for humans · professional agents · strands sdk
            </p>

            <h1 className="display-serif max-w-5xl text-4xl leading-[1.05] text-balance md:text-6xl lg:text-7xl">
              Stop the agent{" "}
              <span className="accent-crimson">before</span> it signs the{" "}
              <span className="accent-crimson">drain</span>.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-mute md:text-lg">
              AgentShield is NOKARA&apos;s Strands professional agent for people who
              run autonomous trading bots. It investigates proposed transactions,
              blocks prompt-injection and honeypots, and only surfaces you when
              judgment is required.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/soc"
                className="btn-crimson rounded px-5 py-2.5 text-sm font-medium"
              >
                Open Flight Recorder
              </Link>
              <a
                href="#gates"
                className="rounded border border-line-strong px-5 py-2.5 text-sm text-ink hover:bg-elevated"
              >
                How the gates work
              </a>
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-6 text-xs text-mute">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-block" />
                BLOCK on injection / honeypot
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-quarantine" />
                QUARANTINE novel contracts
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-allow" />
                ALLOW clean intent + tx
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-6 md:py-16">
          <section id="gates" className="grid gap-3 md:grid-cols-3">
            {[
              {
                k: "Gate 1",
                t: "Deterministic choke point",
                d: "Value caps, allow/deny lists, rate limits, novel-contract quarantine, Morse/stego injection scans, honeypot IOC match. No model can argue with it.",
              },
              {
                k: "Gate 2",
                t: "Adversarial reviewer",
                d: "Sees only proposed tx + provenance — never the agent chat. Scores hijack likelihood via Bedrock / SpaceXAI, with heuristic fallback.",
              },
              {
                k: "CTI-Agent",
                t: "Threat intel mesh",
                d: "Honeypots, drainers, x402 Sybil patterns, fake-reviewer rings — emitted as Elastic-ready security events into the Flight Recorder.",
              },
            ].map((c) => (
              <div key={c.k} className="border border-line bg-panel p-5">
                <div className="terminal-header text-crimson">{c.k}</div>
                <h2 className="mt-2 text-lg font-medium">{c.t}</h2>
                <p className="mt-2 text-sm leading-relaxed text-mute">{c.d}</p>
              </div>
            ))}
          </section>

          <section className="mt-10 grid gap-6 border border-line bg-panel p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
            <div>
              <div className="terminal-header mb-3">flight path</div>
              <h2 className="display-serif text-3xl md:text-4xl">
                Provenance in. Verdict out.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-mute md:text-base">
                The Strands loop calls the same tools the Attack Lab exercises:
                injection scan, honeypot check, CTI lookup, Gate 1, Gate 2,
                finalize, notify. Humans only get paged on BLOCK or QUARANTINE.
              </p>
              <Link
                href="/soc"
                className="mt-6 inline-block btn-crimson rounded px-4 py-2 text-sm font-medium"
              >
                Run Attack Lab →
              </Link>
            </div>
            <pre className="overflow-x-auto rounded border border-line bg-canvas p-4 text-[11px] leading-5 text-mute md:text-xs">{`
trading agent proposes tx + provenance
              │
              ▼
┌─────────────────────────────┐
│  STRANDS · AgentShield      │
│  @tool security suite       │
└─────────────┬───────────────┘
              ▼
     ALLOW / BLOCK / QUARANTINE
              │
              ▼
   Flight Recorder + Elastic doc
`}</pre>
          </section>

          <section className="mt-8 grid gap-3 md:grid-cols-2">
            <div className="border border-line bg-panel p-5">
              <div className="terminal-header">for nokara · professional agents</div>
              <ul className="mt-3 space-y-2 text-sm text-mute">
                <li>
                  Built for the AWS Agents for Humans hackathon — Professional
                  Agents track.
                </li>
                <li>
                  Required stack: Strands Agents SDK + AWS account (Bedrock preferred).
                </li>
                <li>
                  Demo punchline: Morse-code metadata injection blocked live, 6/6
                  Attack Lab scenarios matched.
                </li>
                <li>
                  Entrant org: <span className="text-ink">NOKARA Labs</span> —
                  teammate joins Devpost when online.
                </li>
              </ul>
            </div>
            <div className="border border-line bg-panel p-5">
              <div className="terminal-header">stack</div>
              <ul className="mt-3 space-y-2 text-sm text-mute">
                <li>Strands Agents SDK (`agent/`) with 7 security tools</li>
                <li>Amazon Bedrock default · SpaceXAI / OpenAI fallback</li>
                <li>FastAPI bridge + Next.js Flight Recorder</li>
                <li>Elastic Security document schema</li>
                <li>Solidity scaffolds: x402 settlement + reputation</li>
              </ul>
            </div>
          </section>

          <footer className="mt-14 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-6">
            <div>
              <div className="display-serif text-2xl">AgentShield</div>
              <div className="mt-1 text-xs text-mute">
                NOKARA Labs · charcoal #0a0a0a · crimson #ef4444 · not another trading bot
              </div>
            </div>
            <Image
              src="/agentshield-mark.svg"
              alt=""
              width={40}
              height={40}
              className="opacity-90"
            />
          </footer>
        </div>
      </main>
    </Shell>
  );
}
