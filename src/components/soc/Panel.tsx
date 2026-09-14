import type { ReactNode } from "react";
import { ArrowClockwise, ArrowUpRight, WifiSlash } from "@phosphor-icons/react/dist/ssr";

function sentence(s: string) {
  if (s !== s.toUpperCase()) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** Section container: title row + body. `code` is accepted for older call sites and ignored. */
export function Panel({
  label,
  meta = [],
  right,
  children,
  className = "",
  bodyClassName = "",
}: {
  code?: string;
  label: string;
  meta?: (string | null | undefined | false)[];
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const notes = meta.filter(Boolean) as string[];
  return (
    <section className={`rounded-[10px] border border-line bg-panel ${className}`}>
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h2 className="text-[13px] font-medium text-ink">{sentence(label)}</h2>
          {notes.length > 0 && <span className="truncate text-xs text-faint">{notes.map(sentence).join(", ")}</span>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-2 text-xs font-medium text-faint ${className}`}>{children}</div>;
}

export function ExtLink({ href, children, className = "" }: { href: string | null; children: ReactNode; className?: string }) {
  if (!href) return <span className={`font-mono ${className}`}>{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-0.5 font-mono underline decoration-line-strong underline-offset-4 transition-colors hover:text-ink hover:decoration-mute ${className}`}
    >
      {children}
      <ArrowUpRight size={12} className="text-faint" aria-hidden />
    </a>
  );
}

export function JsonBlock({ value, className = "" }: { value: unknown; className?: string }) {
  return (
    <pre
      className={`overflow-auto rounded-md border border-line bg-canvas p-3 font-mono text-[11.5px] leading-5 text-mute ${className}`}
    >
      {JSON.stringify(value, null, 2) ?? "null"}
    </pre>
  );
}

export function OfflineState({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[10px] border border-block/30 bg-block/[0.06] px-5 py-5">
      <div className="flex items-center gap-2 text-sm font-medium text-block">
        <WifiSlash size={16} aria-hidden />
        Agent unreachable
      </div>
      <p className="max-w-xl text-[13px] text-mute">
        The console can&apos;t reach the AgentShield runtime, so no verdicts are being produced. Trading agents using the
        SDK fail closed until it is back.
      </p>
      {error && <code className="max-w-full break-all font-mono text-[11px] text-faint">{error}</code>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong px-3 text-[13px] text-ink transition-colors hover:bg-elevated"
        >
          <ArrowClockwise size={14} aria-hidden />
          Retry
        </button>
      )}
    </div>
  );
}

export function ErrorLine({ error }: { error: string }) {
  return (
    <div role="alert" className="rounded-md border border-block/30 bg-block/[0.06] px-3 py-2 text-[13px] text-block">
      {error}
    </div>
  );
}
