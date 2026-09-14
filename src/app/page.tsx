import Image from "next/image";
import {
  ArrowRight,
  Brain,
  Cube,
  Database,
  GithubLogo,
  HandCoins,
  ListChecks,
  ShieldCheck,
  UserFocus,
} from "@phosphor-icons/react/dist/ssr";
import { Shell } from "@/components/Shell";
import { ButtonLink } from "@/components/ui/Button";
import { AttackShowcase } from "@/components/landing/AttackShowcase";
import { CodeTabs } from "@/components/landing/CodeTabs";
import { HeroVisual } from "@/components/landing/HeroVisual";
import { LiveNumbers } from "@/components/landing/LiveNumbers";

const REGISTRY = "0x7F030f959769c2eF4CCC05DB62723BAA1E5Fe82e";

const STEPS = [
  {
    icon: ListChecks,
    title: "Intent, sources, transaction",
    body: "Your agent sends what the human asked for, what it read, and the transaction it wants to sign.",
  },
  {
    icon: ShieldCheck,
    title: "Rules first",
    body: "Caps, known drainers, Morse and hidden-Unicode payloads, and live Base checks. A critical failure blocks outright.",
  },
  {
    icon: Brain,
    title: "Investigation",
    body: "A Strands agent works the case with seven tools, then an isolated reviewer that never sees its reasoning scores the hijack risk.",
  },
  {
    icon: UserFocus,
    title: "Verdict",
    body: "Allow, block, or hold for a human. Every step is recorded, and models can tighten a verdict but never loosen it.",
  },
];

const CONTRACT = [
  { d: "ALLOW", tone: "text-allow", what: "guard() calls your signer" },
  { d: "BLOCK", tone: "text-block", what: "raises, nothing is signed" },
  { d: "QUARANTINE", tone: "text-quarantine", what: "waits for an operator to approve or deny" },
  { d: "Unreachable", tone: "text-mute", what: "fails closed by default" },
];

export default function HomePage() {
  return (
    <Shell active="home">
      <main>
        <section className="mx-auto grid max-w-[1400px] items-center gap-10 px-4 pb-14 pt-12 md:px-6 md:pt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-14 lg:pb-20">
          <div className="min-w-0">
            <p className="mb-5 text-[13px] text-faint">Built with Strands Agents on AWS</p>
            <h1 className="max-w-[16ch] text-[40px] font-semibold leading-[1.04] tracking-[-0.035em] md:text-[56px]">
              Stop the agent before it signs the drain.
            </h1>
            <p className="mt-5 max-w-[46ch] text-[17px] leading-relaxed text-mute">
              AgentShield reviews every transaction your trading agents propose, blocks drains and honeypots, and pages you only for
              judgment calls.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/soc" variant="primary" size="lg">
                Open console
              </ButtonLink>
              <ButtonLink href="#sdk" variant="secondary" size="lg">
                Get the SDK
              </ButtonLink>
            </div>
          </div>
          <HeroVisual />
        </section>

        <LiveNumbers />

        <section className="mx-auto max-w-[1400px] px-4 py-20 md:px-6 md:py-28">
          <h2 className="max-w-[22ch] text-[32px] font-semibold leading-tight tracking-[-0.025em] md:text-[40px]">
            Real attacks, recorded verdicts.
          </h2>
          <p className="mb-10 mt-3 max-w-[60ch] text-[15px] text-mute">
            Each case below is a scenario on Base mainnet contracts and the last verdict the recorder stored for it. The highlighted text is
            what tried to steer the agent.
          </p>
          <AttackShowcase />
        </section>

        <section id="how" className="scroll-mt-20 border-t border-line">
          <div className="mx-auto max-w-[1400px] px-4 py-20 md:px-6 md:py-28">
            <h2 className="text-[32px] font-semibold leading-tight tracking-[-0.025em] md:text-[40px]">How a check works</h2>
            <ol className="relative mt-12 grid gap-10 md:grid-cols-4 md:gap-6">
              <span className="absolute left-0 right-0 top-[19px] hidden h-px bg-line-strong md:block" aria-hidden />
              {STEPS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="relative min-w-0">
                  <div className="flex items-center gap-3 md:block">
                    <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line-strong bg-canvas text-ink">
                      <Icon size={18} />
                    </div>
                    <h3 className="text-[15px] font-medium text-ink md:mt-5">{title}</h3>
                  </div>
                  <p className="mt-3 max-w-[34ch] text-[14px] leading-relaxed text-mute md:mt-2">{body}</p>
                </li>
              ))}
            </ol>
            <div className="mt-14 overflow-x-auto rounded-md border border-line bg-panel px-5 py-4 font-mono text-[13px] text-mute">
              <span className="text-faint">final = </span>
              <span className="text-ink">strictest</span>(gate1_floor, gate2_reviewer, orchestrator)
              <span className="ml-3 text-faint"># a hijacked model can cause a false block, never a false allow</span>
            </div>
          </div>
        </section>

        <section id="sdk" className="scroll-mt-20 border-t border-line">
          <div className="mx-auto grid max-w-[1400px] gap-12 px-4 py-20 md:px-6 md:py-28 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="min-w-0">
              <h2 className="text-[32px] font-semibold leading-tight tracking-[-0.025em] md:text-[40px]">One call before you sign.</h2>
              <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-mute">
                Wrap your signer with the Python or TypeScript SDK. It sends the check, waits on review when needed, and never signs without an
                allow.
              </p>
              <dl className="mt-8 divide-y divide-line border-y border-line">
                {CONTRACT.map((c) => (
                  <div key={c.d} className="flex items-baseline justify-between gap-4 py-3">
                    <dt className={`font-mono text-[13px] ${c.tone}`}>{c.d}</dt>
                    <dd className="text-right text-[14px] text-mute">{c.what}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-6 text-[13px] text-faint">
                Agents without an account can pay per check over x402: $0.001 fast, $0.01 with the full investigation, USDC on Base Sepolia.
              </p>
            </div>
            <CodeTabs />
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto max-w-[1400px] px-4 py-20 md:px-6 md:py-28">
            <h2 className="text-[32px] font-semibold leading-tight tracking-[-0.025em] md:text-[40px]">What it runs on</h2>
            <div className="mt-10 grid gap-3 md:grid-cols-6 md:grid-rows-2">
              <article className="relative overflow-hidden rounded-[14px] border border-line bg-panel p-6 md:col-span-3 md:row-span-2">
                <div className="hairline-grid absolute inset-0 opacity-50" aria-hidden />
                <div className="relative flex h-full flex-col">
                  <Brain size={22} className="text-ink" />
                  <h3 className="mt-4 text-lg font-medium">Strands Agents</h3>
                  <p className="mt-2 max-w-[42ch] text-[14px] leading-relaxed text-mute">
                    An orchestrator with seven request-scoped tools, a Gate 2 reviewer as a separate agent with structured output, and hooks
                    that turn every model turn and tool call into the trace you see in the console.
                  </p>
                  <pre className="mt-auto overflow-x-auto rounded-md border border-line bg-canvas/80 p-4 font-mono text-[12px] leading-6 text-mute">
{`agent = Agent(model, tools=build_tools(ctx),
              hooks=[TraceHooks(trace)])
reviewer = Agent(model, structured_output_model=Gate2Assessment)`}
                  </pre>
                </div>
              </article>
              <article className="rounded-[14px] border border-line bg-panel p-6 md:col-span-3">
                <Cube size={22} className="text-ink" />
                <h3 className="mt-4 text-lg font-medium">Base</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-mute">
                  Live bytecode, calldata decoding and simulation on mainnet, plus a stake-gated threat registry on Base Sepolia at{" "}
                  <a
                    className="font-mono text-ink underline decoration-line-strong underline-offset-4 hover:decoration-mute"
                    href={`https://sepolia.basescan.org/address/${REGISTRY}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {REGISTRY.slice(0, 8)}…{REGISTRY.slice(-4)}
                  </a>
                  .
                </p>
              </article>
              <article className="rounded-[14px] border border-line bg-elevated p-6 md:col-span-2">
                <Database size={22} className="text-ink" />
                <h3 className="mt-4 text-lg font-medium">ClickHouse</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-mute">Every verdict and trace step, with latency and anomaly analytics.</p>
              </article>
              <article className="rounded-[14px] border border-line bg-panel p-6 md:col-span-1">
                <HandCoins size={22} className="text-ink" />
                <h3 className="mt-4 text-lg font-medium">x402</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-mute">Pay per check.</p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-faint md:px-6">
          <div className="flex items-center gap-2">
            <Image src="/agentshield-mark.svg" alt="" width={18} height={18} />
            <span>AgentShield by NOKARA Labs. MIT licensed.</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://github.com/Njaybby/agentshield" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-ink">
              <GithubLogo size={16} /> Source
            </a>
            <a href="/soc" className="inline-flex items-center gap-1 hover:text-ink">
              Console <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </footer>
    </Shell>
  );
}
