import type { Decision, VerdictStatus } from "@/lib/types";

export const decisionText: Record<Decision, string> = {
  ALLOW: "text-allow",
  BLOCK: "text-block",
  QUARANTINE: "text-quarantine",
};

export const decisionBorder: Record<Decision, string> = {
  ALLOW: "border-allow",
  BLOCK: "border-block",
  QUARANTINE: "border-quarantine",
};

export const decisionBg: Record<Decision, string> = {
  ALLOW: "bg-allow",
  BLOCK: "bg-block",
  QUARANTINE: "bg-quarantine",
};

export function DecisionBadge({
  decision,
  pulse,
  size = "sm",
}: {
  decision: Decision;
  pulse?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-mono font-medium uppercase tracking-[0.12em] ${
        size === "md" ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]"
      } ${decisionBorder[decision]} ${decisionText[decision]} ${pulse && decision === "BLOCK" ? "pulse-block" : ""}`}
    >
      <span className={`h-1.5 w-1.5 ${decisionBg[decision]}`} aria-hidden />
      {decision}
    </span>
  );
}

export function StatusTag({ status }: { status: VerdictStatus }) {
  const map: Record<VerdictStatus, string> = {
    final: "text-mute border-line-strong",
    pending_review: "text-quarantine border-quarantine/60",
    approved: "text-allow border-allow/60",
    denied: "text-block border-block/60",
  };
  const label: Record<VerdictStatus, string> = {
    final: "FINAL",
    pending_review: "AWAITING OPERATOR",
    approved: "APPROVED",
    denied: "DENIED",
  };
  return (
    <span className={`inline-block border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] ${map[status]}`}>
      {label[status]}
    </span>
  );
}
