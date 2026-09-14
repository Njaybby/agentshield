import type { Decision, VerdictStatus } from "@/lib/types";

export const decisionText: Record<Decision, string> = {
  ALLOW: "text-allow",
  BLOCK: "text-block",
  QUARANTINE: "text-quarantine",
};

export const decisionBorder: Record<Decision, string> = {
  ALLOW: "border-allow/35",
  BLOCK: "border-block/35",
  QUARANTINE: "border-quarantine/35",
};

export const decisionBg: Record<Decision, string> = {
  ALLOW: "bg-allow",
  BLOCK: "bg-block",
  QUARANTINE: "bg-quarantine",
};

export const decisionTint: Record<Decision, string> = {
  ALLOW: "bg-allow/10",
  BLOCK: "bg-block/10",
  QUARANTINE: "bg-quarantine/10",
};

export const decisionLabel: Record<Decision, string> = {
  ALLOW: "Allow",
  BLOCK: "Block",
  QUARANTINE: "Quarantine",
};

export function DecisionBadge({
  decision,
  size = "sm",
}: {
  decision: Decision;
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sz = { sm: "h-5 px-1.5 text-[10.5px]", md: "h-6 px-2 text-[11px]", lg: "h-8 px-2.5 text-[13px]" }[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border font-mono font-medium uppercase tracking-[0.06em] ${sz} ${decisionBorder[decision]} ${decisionTint[decision]} ${decisionText[decision]}`}
    >
      {decision}
    </span>
  );
}

export function StatusTag({ status }: { status: VerdictStatus }) {
  const map: Record<VerdictStatus, string> = {
    final: "border-line-strong text-faint",
    pending_review: "border-quarantine/35 bg-quarantine/10 text-quarantine",
    approved: "border-allow/35 bg-allow/10 text-allow",
    denied: "border-block/35 bg-block/10 text-block",
  };
  const label: Record<VerdictStatus, string> = {
    final: "Final",
    pending_review: "Awaiting review",
    approved: "Approved",
    denied: "Denied",
  };
  return (
    <span className={`inline-flex h-5 shrink-0 items-center rounded border px-1.5 text-[11px] ${map[status]}`}>
      {label[status]}
    </span>
  );
}
