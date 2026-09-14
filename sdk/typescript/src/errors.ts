import type { Verdict } from "./types.js";

/** Base error. Anything thrown by guard() means the transaction was not signed. */
export class ShieldError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ShieldUnavailableError extends ShieldError {}

export class BlockedError extends ShieldError {
  constructor(public readonly verdict: Verdict) {
    super(`${verdict.decision} ${verdict.id}: ${verdict.operator_summary}`);
  }
}

/** An operator denied a quarantined transaction. */
export class DeniedError extends BlockedError {}

export class ReviewTimeoutError extends ShieldError {
  constructor(
    public readonly verdict: Verdict,
    waitedMs: number,
  ) {
    super(`no operator decision on ${verdict.id} after ${Math.round(waitedMs / 1000)}s`);
  }
}
