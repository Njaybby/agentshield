import type { ReactNode } from "react";

/** Flight-recorder panel: mono uppercase metadata bar + body. */
export function Panel({
  code,
  label,
  meta = [],
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  code: string;
  label: string;
  meta?: (string | null | undefined | false)[];
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const parts = [code, label, ...meta.filter(Boolean)] as string[];
  return (
    <section className={`border border-line bg-panel ${className}`}>
      <header className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line bg-[#0d0d0d] px-3 py-1.5">
        <div className="terminal-header flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          {parts.map((p, i) => (
            <span key={i} className={`whitespace-nowrap ${i === 0 ? "text-ink" : ""}`}>
              {i > 0 && <span className="mr-2 text-line-strong">·</span>}
              {p}
            </span>
          ))}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`terminal-header mb-2 ${className}`}>{children}</div>;
}

export function ExtLink({ href, children, className = "" }: { href: string | null; children: ReactNode; className?: string }) {
  if (!href) return <span className={`font-mono ${className}`}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`font-mono underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink ${className}`}
    >
      {children}
      <span className="ml-0.5 text-mute" aria-hidden>↗</span>
    </a>
  );
}

export function JsonBlock({ value, className = "" }: { value: unknown; className?: string }) {
  return (
    <pre
      className={`overflow-auto border border-line bg-canvas p-3 font-mono text-[11px] leading-5 text-[#c9c9c9] ${className}`}
    >
      {JSON.stringify(value, null, 2) ?? "null"}
    </pre>
  );
}

export function OfflineState({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <div className="scanline flex flex-col items-start gap-3 border border-dashed border-block/50 bg-[#120909] px-5 py-6">
      <div className="flex items-center gap-2 font-mono text-xs tracking-[0.14em] text-block">
        <span className="h-2 w-2 bg-block pulse-block" aria-hidden />
        RECORDER OFFLINE: AGENT UNREACHABLE
      </div>
      <p className="max-w-xl text-sm text-mute">
        The Flight Recorder can&apos;t reach the AgentShield runtime. No verdicts are being produced;
        trading agents relying on the shield should fail closed.
      </p>
      {error && <code className="max-w-full break-all font-mono text-[11px] text-mute">{error}</code>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="border border-line-strong px-3 py-1.5 font-mono text-xs tracking-wider text-ink hover:bg-elevated"
        >
          RETRY LINK
        </button>
      )}
    </div>
  );
}

export function ErrorLine({ error }: { error: string }) {
  return (
    <div className="border border-block/60 bg-[#140a0a] px-3 py-2 font-mono text-xs text-block">ERR · {error}</div>
  );
}
