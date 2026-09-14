import type { ProposedTx, ProvenanceSource, ShieldRequest } from "./types.js";

export interface ViemLikeTx {
  to: string;
  value?: bigint | number | string;
  data?: string;
  chainId?: number;
}

export interface TxContext {
  /** What the human asked the agent to do. */
  intent: string;
  /** What the agent read before proposing this tx. Strings become {type: "text"}. */
  sources?: (string | ProvenanceSource)[];
  agentId?: string;
  chainId?: number;
  method?: string;
  tokenSymbol?: string;
  tokenAddress?: string;
  spender?: string;
  amountHuman?: string;
}

function toWei(value: ViemLikeTx["value"]): string {
  if (value === undefined || value === null) return "0";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("value must be a bigint or safe integer (wei)");
    return String(value);
  }
  return BigInt(value).toString();
}

export function fromViemTx(tx: ViemLikeTx, ctx: TxContext): ShieldRequest {
  if (!ctx.intent) throw new Error("intent is required");
  const chainId = tx.chainId ?? ctx.chainId;
  if (chainId === undefined) throw new Error("chainId is required (on the tx or in ctx)");

  const proposed: ProposedTx = { to: tx.to, value_wei: toWei(tx.value), chain_id: chainId };
  if (tx.data && tx.data !== "0x") proposed.data = tx.data;
  if (ctx.method) proposed.method = ctx.method;
  if (ctx.tokenSymbol) proposed.token_symbol = ctx.tokenSymbol;
  if (ctx.tokenAddress) proposed.token_address = ctx.tokenAddress;
  if (ctx.spender) proposed.spender = ctx.spender;
  if (ctx.amountHuman) proposed.amount_human = ctx.amountHuman;

  return {
    agent_id: ctx.agentId ?? "agent",
    provenance: {
      user_intent: ctx.intent,
      sources: (ctx.sources ?? []).map((s) => (typeof s === "string" ? { type: "text", content: s } : s)),
    },
    proposed_tx: proposed,
  };
}
