import type { Decision } from "@/lib/shield/types";

export function DecisionBadge({
  decision,
  pulse,
}: {
  decision: Decision;
  pulse?: boolean;
}) {
  const styles =
    decision === "ALLOW"
      ? "border-allow text-allow"
      : decision === "QUARANTINE"
        ? "border-quarantine text-quarantine"
        : "border-block text-block";

  return (
    <span
      className={`inline-block rounded border px-2 py-0.5 text-xs font-medium uppercase tracking-wider tabular ${styles} ${
        pulse && decision === "BLOCK" ? "pulse-block" : ""
      }`}
    >
      {decision}
    </span>
  );
}
