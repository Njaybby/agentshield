import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  hint,
  tone = "text-ink",
  size = "md",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
  size?: "md" | "lg";
}) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-faint">{label}</div>
      <div
        className={`mt-1 font-mono tabular-nums tracking-tight ${tone} ${size === "lg" ? "text-4xl" : "text-[28px] leading-9"}`}
      >
        {value ?? "-"}
      </div>
      {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-faint">{icon}</div>}
      <div className="text-sm font-medium text-ink">{title}</div>
      {body && <div className="max-w-sm text-[13px] text-faint">{body}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line-strong bg-elevated px-1.5 py-0.5 font-mono text-[11px] text-mute">
      {children}
    </kbd>
  );
}

export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded border border-line-strong px-1.5 py-px text-[11px] text-mute ${className}`}>
      {children}
    </span>
  );
}
