import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { paymentMiddleware } from "x402-next";

// x402 gate for the public API. POST /api/v1/shield costs $0.001 (fast mode),
// POST /api/v1/shield/agent costs $0.01 (agent mode). USDC on Base Sepolia, settled
// through the public facilitator. Only /api/v1/* is matched; the console and /api/rpc stay free.
const payTo = (process.env.X402_PAY_TO || process.env.DEPLOYER_ADDRESS || "") as `0x${string}`;

if (!payTo) {
  // Fail loudly in logs rather than silently accepting unpayable requests.
  console.warn(
    "[x402] Neither X402_PAY_TO nor DEPLOYER_ADDRESS is set; /api/v1/shield will reject all payments.",
  );
}

const FACILITATOR_URL = "https://x402.org/facilitator" as const;

const FAST_DESCRIPTION =
  "AgentShield pre-trade security check (fast mode: policy + prompt-injection + on-chain gates)";
const AGENT_DESCRIPTION =
  "AgentShield pre-trade security check (full Strands agent mode, adversarial LLM review)";

const x402Gate = paymentMiddleware(
  payTo,
  {
    "POST /api/v1/shield": {
      price: "$0.001",
      network: "base-sepolia",
      config: { description: FAST_DESCRIPTION },
    },
    "POST /api/v1/shield/agent": {
      price: "$0.01",
      network: "base-sepolia",
      config: { description: AGENT_DESCRIPTION },
    },
  },
  { url: FACILITATOR_URL },
);

export async function middleware(request: NextRequest) {
  const result = await x402Gate(request);

  // No valid payment: return the 402 (or error) response built by x402-next.
  if (result.status >= 400) return result;

  // Paid. /agent has no route file: rewrite to /api/v1/shield and flag agent mode in a header.
  if (request.nextUrl.pathname === "/api/v1/shield/agent") {
    const headers = new Headers(request.headers);
    headers.set("x-agentshield-mode", "agent");
    const rewritten = NextResponse.rewrite(new URL("/api/v1/shield", request.url), {
      request: { headers },
    });
    const settlement = result.headers.get("X-PAYMENT-RESPONSE");
    if (settlement) rewritten.headers.set("X-PAYMENT-RESPONSE", settlement);
    return rewritten;
  }

  return result;
}

export const config = {
  matcher: ["/api/v1/:path*"],
  runtime: "nodejs",
};
