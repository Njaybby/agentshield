import Link from "next/link";
import Image from "next/image";

export function Shell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "home" | "soc";
}) {
  return (
    <div className="relative min-h-[100dvh] bg-canvas text-ink">
      <div className="as-grain" aria-hidden />
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-2 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/agentshield-mark.svg"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7"
            />
            <div className="leading-none">
              <div className="display-serif text-xl text-ink">AgentShield</div>
              <div className="terminal-header mt-0.5 hidden sm:block">NOKARA Labs · Pre-trade firewall</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className={`whitespace-nowrap rounded px-2.5 py-1.5 text-sm sm:px-3 ${
                active === "home"
                  ? "border border-line-strong bg-elevated text-ink"
                  : "text-mute hover:text-ink"
              }`}
            >
              Overview
            </Link>
            <Link
              href="/soc"
              className={`whitespace-nowrap rounded px-2.5 py-1.5 text-sm sm:px-3 ${
                active === "soc"
                  ? "border border-line-strong bg-elevated text-ink"
                  : "text-mute hover:text-ink"
              }`}
            >
              Flight Recorder
            </Link>
            <Link
              href="/soc#lab"
              className="ml-1 hidden rounded btn-crimson px-3 py-1.5 text-sm font-medium sm:inline-block"
            >
              Attack Lab
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
