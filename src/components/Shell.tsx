import Link from "next/link";
import Image from "next/image";
import { GithubLogo } from "@phosphor-icons/react/dist/ssr";
import { ButtonLink } from "@/components/ui/Button";

const REPO = "https://github.com/Njaybby/agentshield";

export function Shell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "home" | "soc";
}) {
  const link = (on: boolean) =>
    `hidden rounded-md px-2.5 py-1.5 text-[13px] transition-colors sm:inline-block ${on ? "text-ink" : "text-mute hover:text-ink"}`;
  return (
    <div className="relative min-h-[100dvh] bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-1.5 focus:text-canvas">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="AgentShield home">
            <Image src="/agentshield-mark.svg" alt="" width={22} height={22} className="h-[22px] w-[22px]" priority />
            <span className="text-[15px] font-semibold tracking-tight">AgentShield</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/#how" className={link(false)}>
              How it works
            </Link>
            <Link href="/#sdk" className={link(false)}>
              SDK
            </Link>
            <Link href="/soc" className={link(active === "soc")}>
              Console
            </Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="rounded-md p-2 text-mute transition-colors hover:text-ink" aria-label="Source on GitHub">
              <GithubLogo size={18} />
            </a>
            {active !== "soc" && (
              <ButtonLink href="/soc" variant="primary" size="sm" className="ml-1">
                Open console
              </ButtonLink>
            )}
          </nav>
        </div>
      </header>
      <div id="main">{children}</div>
    </div>
  );
}
