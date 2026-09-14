"use client";

import { useId, useState } from "react";
import { CheckCircle, XCircle } from "@phosphor-icons/react";
import type { Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { formatEth, relTime, short } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "./Panel";

const OPERATOR_KEY = "agentshield.operator";

function initialOperator() {
  if (typeof window === "undefined") return "operator@nokara";
  try {
    return window.localStorage.getItem(OPERATOR_KEY) || "operator@nokara";
  } catch {
    return "operator@nokara";
  }
}

/** Operator sign-off: pick an action, confirm the consequence, then it is written to the recorder. */
export function ReviewControls({
  verdict,
  onReviewed,
  compact,
}: {
  verdict: Verdict;
  onReviewed: (v: Verdict) => void;
  compact?: boolean;
}) {
  const [note, setNote] = useState("");
  const [operator, setOperator] = useState(initialOperator);
  const [armed, setArmed] = useState<"APPROVE" | "DENY" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteId = useId();
  const opId = useId();

  if (verdict.status !== "pending_review") {
    if (!verdict.review) return null;
    const ok = verdict.review.action === "APPROVE";
    return (
      <div className={`stamp rounded-md border px-3 py-2.5 ${ok ? "border-allow/30 bg-allow/[0.06]" : "border-block/30 bg-block/[0.06]"}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          {ok ? <CheckCircle size={16} className="text-allow" aria-hidden /> : <XCircle size={16} className="text-block" aria-hidden />}
          <span className={ok ? "text-allow" : "text-block"}>{ok ? "Approved for signing" : "Denied, not signed"}</span>
          <span className="text-faint">
            by <span className="font-mono text-mute">{verdict.review.operator}</span>, {relTime(verdict.review.ts)}
          </span>
        </div>
        {verdict.review.note && <p className="mt-1 text-[13px] text-mute">&ldquo;{verdict.review.note}&rdquo;</p>}
      </div>
    );
  }

  const submit = async (action: "APPROVE" | "DENY") => {
    setBusy(true);
    setError(null);
    try {
      window.localStorage.setItem(OPERATOR_KEY, operator);
    } catch {
      // storage unavailable
    }
    // The envelope field `action` is "review", so the operator's choice travels as review_action (and decision).
    const res = await rpc<Verdict>("review", { verdict_id: verdict.id, review_action: action, decision: action, note, operator });
    setBusy(false);
    if (hasError(res)) {
      setError(res.offline ? `Agent unreachable: ${res.error}` : res.error);
      return;
    }
    setArmed(null);
    onReviewed(res);
  };

  const tx = verdict.proposed_tx;

  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-[1fr_200px]"}`}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={noteId} className="text-xs text-faint">
            Note
          </label>
          <textarea
            id={noteId}
            className="field min-h-[64px] resize-y"
            placeholder="Why you approved or denied it…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={opId} className="text-xs text-faint">
            Reviewer
          </label>
          <input
            id={opId}
            className="field font-mono"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>

      {!armed ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="text-allow hover:text-allow" onClick={() => setArmed("APPROVE")}>
            <CheckCircle size={16} aria-hidden />
            Approve and sign
          </Button>
          <Button variant="danger" onClick={() => setArmed("DENY")}>
            <XCircle size={16} aria-hidden />
            Deny
          </Button>
        </div>
      ) : (
        <div className={`stamp rounded-md border px-3 py-3 ${armed === "APPROVE" ? "border-allow/30 bg-allow/[0.05]" : "border-block/30 bg-block/[0.05]"}`}>
          <p className="text-[13px] text-ink">
            {armed === "APPROVE" ? (
              <>
                The agent will sign and broadcast <span className="font-mono">{tx.method ?? "call"}()</span> for{" "}
                <span className="font-mono">{tx.amount_human || formatEth(tx.value_wei)}</span> to{" "}
                <span className="font-mono">{short(tx.to)}</span>.
              </>
            ) : (
              <>
                The agent gets a final block and <span className="font-mono">{short(tx.to)}</span> is recorded against{" "}
                <span className="font-mono">{verdict.agent_id}</span>.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant={armed === "APPROVE" ? "primary" : "danger"}
              size="sm"
              disabled={busy}
              onClick={() => submit(armed)}
            >
              {busy ? "Saving…" : armed === "APPROVE" ? "Confirm approval" : "Confirm denial"}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setArmed(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {error && <ErrorLine error={error} />}
    </div>
  );
}
