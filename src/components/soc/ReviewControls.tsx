"use client";

import { useState } from "react";
import type { Verdict } from "@/lib/types";
import { hasError, rpc } from "@/lib/rpc";
import { clock, formatEth, short } from "@/lib/format";

const OPERATOR_KEY = "agentshield.operator";

function initialOperator() {
  if (typeof window === "undefined") return "operator@nokara";
  try {
    return window.localStorage.getItem(OPERATOR_KEY) || "operator@nokara";
  } catch {
    return "operator@nokara";
  }
}

/** Human-in-the-loop sign-off. Two-step: choose action, then confirm with consequence spelled out. */
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

  if (verdict.status !== "pending_review") {
    if (!verdict.review) return null;
    const ok = verdict.review.action === "APPROVE";
    return (
      <div className={`stamp flex flex-wrap items-center gap-x-4 gap-y-1 border px-3 py-2.5 ${ok ? "border-allow/60 bg-allow/5" : "border-block/60 bg-block/5"}`}>
        <span className={`font-mono text-sm font-semibold tracking-[0.18em] ${ok ? "text-allow" : "text-block"}`}>
          {ok ? "RELEASED FOR SIGNING" : "DENIED · NOT SIGNED"}
        </span>
        <span className="terminal-header">
          {verdict.review.operator} · {clock(verdict.review.ts)}
        </span>
        {verdict.review.note && <span className="w-full text-sm text-mute">“{verdict.review.note}”</span>}
      </div>
    );
  }

  const submit = async (action: "APPROVE" | "DENY") => {
    setBusy(true);
    setError(null);
    try {
      window.localStorage.setItem(OPERATOR_KEY, operator);
    } catch {
      /* storage unavailable */
    }
    // The RPC envelope's `action` is "review", which collides with the contract's review `action` field.
    // Send the operator's choice as `review_action` (plus `decision` alias) so it survives the envelope.
    const res = await rpc<Verdict>("review", { verdict_id: verdict.id, review_action: action, decision: action, note, operator });
    setBusy(false);
    if (hasError(res)) {
      setError(res.offline ? `recorder offline: ${res.error}` : res.error);
      return;
    }
    setArmed(null);
    onReviewed(res);
  };

  const tx = verdict.proposed_tx;

  return (
    <div className="space-y-2.5">
      <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-[1fr_200px]"}`}>
        <textarea
          className="field min-h-[58px] resize-y"
          placeholder="Decision note (logged to ClickHouse with your verdict)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
        />
        <label className="flex flex-col gap-1">
          <span className="terminal-header">operator</span>
          <input className="field font-mono" value={operator} onChange={(e) => setOperator(e.target.value)} disabled={busy} />
        </label>
      </div>

      {!armed ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setArmed("APPROVE")}
            className="border border-allow/70 px-4 py-2 font-mono text-xs tracking-[0.14em] text-allow hover:bg-allow/10"
          >
            APPROVE
          </button>
          <button
            type="button"
            onClick={() => setArmed("DENY")}
            className="btn-crimson px-4 py-2 font-mono text-xs tracking-[0.14em]"
          >
            DENY
          </button>
        </div>
      ) : (
        <div className={`border px-3 py-3 ${armed === "APPROVE" ? "border-allow/60 bg-allow/5" : "border-block/60 bg-block/5"}`}>
          <p className="text-sm text-ink">
            {armed === "APPROVE" ? (
              <>
                Release <span className="font-mono">{tx.amount_human || formatEth(tx.value_wei)}</span>{" "}
                <span className="font-mono">{tx.method ?? "call"}()</span> to{" "}
                <span className="font-mono">{short(tx.to)}</span> for signing. The trading agent will broadcast it.
              </>
            ) : (
              <>
                Reject this transaction. The trading agent receives a hard BLOCK and the counterparty{" "}
                <span className="font-mono">{short(tx.to)}</span> is recorded against {verdict.agent_id}.
              </>
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => submit(armed)}
              className={`px-4 py-2 font-mono text-xs font-semibold tracking-[0.14em] disabled:opacity-60 ${
                armed === "APPROVE" ? "bg-allow text-black hover:brightness-110" : "btn-crimson"
              }`}
            >
              {busy ? "SIGNING OFF…" : armed === "APPROVE" ? "CONFIRM APPROVE" : "CONFIRM DENY"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setArmed(null)}
              className="border border-line-strong px-4 py-2 font-mono text-xs tracking-[0.14em] text-mute hover:text-ink"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}
      {error && <div className="font-mono text-xs text-block">ERR · {error}</div>}
    </div>
  );
}
