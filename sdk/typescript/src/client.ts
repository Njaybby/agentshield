import { BlockedError, DeniedError, ReviewTimeoutError, ShieldError, ShieldUnavailableError } from "./errors.js";
import type { Mode, ProposedTx, ShieldRequest, Verdict } from "./types.js";

export const DEFAULT_BASE_URL = "https://agentshield-lyart.vercel.app";

export interface ShieldOptions {
  baseUrl?: string;
  mode?: Mode;
  timeoutMs?: number;
  /** Throw when the shield is unreachable (default). false signs without a verdict. */
  failClosed?: boolean;
  pollEveryMs?: number;
  maxWaitMs?: number;
  /** Custom fetch, e.g. wrapFetchWithPayment(fetch, wallet) from x402-fetch. */
  fetch?: typeof fetch;
  /** Use the x402 endpoints (/api/v1/shield, /api/v1/shield/agent). Needs a paying fetch. */
  paid?: boolean;
}

const DECISIONS = new Set(["ALLOW", "BLOCK", "QUARANTINE"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Shield {
  readonly baseUrl: string;
  readonly mode: Mode;
  readonly failClosed: boolean;
  private readonly timeoutMs: number;
  private readonly pollEveryMs: number;
  private readonly maxWaitMs: number;
  private readonly paid: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ShieldOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.mode = opts.mode ?? "fast";
    this.failClosed = opts.failClosed ?? true;
    this.timeoutMs = opts.timeoutMs ?? 90_000;
    this.pollEveryMs = opts.pollEveryMs ?? 5_000;
    this.maxWaitMs = opts.maxWaitMs ?? 30 * 60_000;
    this.paid = opts.paid ?? false;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) throw new Error("no fetch available; pass options.fetch");
  }

  private async post(path: string, payload: unknown): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ShieldUnavailableError(`shield unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ShieldUnavailableError(`shield returned non-JSON (HTTP ${res.status})`);
    }
    if (res.status === 402) {
      throw new ShieldError("payment required: pass a paying fetch (x402-fetch) or drop paid: true");
    }
    const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    if (obj.error) {
      // outages and rate limits are unavailability; anything else is a bad request
      if (res.status >= 500 || res.status === 429 || obj.offline === true) {
        throw new ShieldUnavailableError(String(obj.error));
      }
      throw new ShieldError(String(obj.error));
    }
    if (!res.ok) throw new ShieldUnavailableError(`HTTP ${res.status}`);
    return obj;
  }

  private static verdict(body: Record<string, unknown>): Verdict {
    if (!DECISIONS.has(body.decision as string)) throw new ShieldUnavailableError("response has no decision");
    return body as unknown as Verdict;
  }

  async check(request: ShieldRequest, mode: Mode = this.mode): Promise<Verdict> {
    if (this.paid) {
      const path = mode === "agent" ? "/api/v1/shield/agent" : "/api/v1/shield";
      return Shield.verdict(await this.post(path, request));
    }
    return Shield.verdict(await this.post("/api/rpc", { action: "shield", mode, request }));
  }

  async getVerdict(id: string): Promise<Verdict> {
    return Shield.verdict(await this.post("/api/rpc", { action: "telemetry", view: "verdict", id }));
  }

  async waitForReview(id: string, opts: { pollEveryMs?: number; maxWaitMs?: number } = {}): Promise<Verdict> {
    const pollEveryMs = opts.pollEveryMs ?? this.pollEveryMs;
    const maxWaitMs = opts.maxWaitMs ?? this.maxWaitMs;
    const start = Date.now();
    for (;;) {
      const v = await this.getVerdict(id);
      if (v.status !== "pending_review") return v;
      const waited = Date.now() - start;
      if (waited >= maxWaitMs) throw new ReviewTimeoutError(v, waited);
      await sleep(pollEveryMs);
    }
  }

  /** Sign only if AgentShield allows it. Throws BlockedError, DeniedError, ReviewTimeoutError or ShieldUnavailableError otherwise. */
  async guard<T>(request: ShieldRequest, signFn: (tx: ProposedTx) => T | Promise<T>, mode: Mode = this.mode): Promise<T> {
    let v: Verdict;
    try {
      v = await this.check(request, mode);
    } catch (err) {
      if (err instanceof ShieldUnavailableError && !this.failClosed) {
        console.warn("agentshield unavailable, failClosed=false: signing without a verdict");
        return signFn(request.proposed_tx);
      }
      throw err;
    }

    if (v.decision === "BLOCK") throw new BlockedError(v);
    if (v.decision === "QUARANTINE" && v.status === "pending_review") v = await this.waitForReview(v.id);
    if (v.status === "denied") throw new DeniedError(v);
    if (v.decision === "ALLOW" || v.status === "approved") return signFn(request.proposed_tx);
    throw new BlockedError(v);
  }
}
