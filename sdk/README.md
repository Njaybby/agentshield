# AgentShield SDK

Clients for calling AgentShield between "the agent decided" and "the wallet signed". You send the
transaction, the human's intent and what the agent read. You get back `ALLOW`, `BLOCK` or `QUARANTINE`,
and `guard()` only calls your signer when the answer is allow.

- `python/`: `agentshield` for Python 3.10+ (depends on httpx)
- `typescript/`: `@agentshield/sdk` for Node 18+, no runtime dependencies
- `examples/trading-bot.mjs`: a bot that runs a drainer approval and a clean swap through the shield

Both default to the public demo at `https://agentshield-lyart.vercel.app`.

## Install

Not published yet. Install from a checkout:

```bash
pip install ./sdk/python
npm install ./sdk/typescript   # runs tsc via the prepare script
```

## Python

```python
from agentshield import Shield, Blocked, ShieldUnavailable, request_from_tx

shield = Shield("https://agentshield-lyart.vercel.app", mode="fast")

tx = {"to": router, "value": 0, "data": calldata, "chainId": 8453}
req = request_from_tx(
    tx,
    intent="Approve the DEX router so I can swap 250 USDC",
    sources=[tool_output],          # what the agent read
    agent_id="desk-rebalancer-02",
    method="approve",
)

try:
    tx_hash = shield.guard(req, lambda _: w3.eth.send_transaction(tx))
except Blocked as e:                # BLOCK, or an operator denied it
    log.warning("not signed: %s", e.verdict.operator_summary)
except ShieldUnavailable:
    log.error("shield down, not signed")
```

Or wrap the signer once:

```python
@shield.protect(chain_id=8453)
def send(tx):
    return w3.eth.send_transaction(tx)

send(tx, intent="Swap 0.05 ETH to USDC", sources=[quote_text])
```

## TypeScript

```ts
import { Shield, BlockedError, ShieldUnavailableError, fromViemTx } from "@agentshield/sdk";

const shield = new Shield({ baseUrl: "https://agentshield-lyart.vercel.app", mode: "fast" });

const tx = { to: router, value: 0n, data: calldata, chainId: 8453 };
const request = fromViemTx(tx, {
  intent: "Approve the DEX router so I can swap 250 USDC",
  sources: [toolOutput],
  agentId: "desk-rebalancer-02",
  method: "approve",
});

try {
  const hash = await shield.guard(request, () => walletClient.sendTransaction(tx));
} catch (err) {
  if (err instanceof BlockedError) console.warn("not signed:", err.verdict.operator_summary);
  else if (err instanceof ShieldUnavailableError) console.error("shield down, not signed");
  else throw err;
}
```

## What guard() does

| Decision | Status | guard() |
|----------|--------|---------|
| ALLOW | final | calls your signer and returns its result |
| BLOCK | final | throws `Blocked` / `BlockedError`, signer never runs |
| QUARANTINE | pending_review | polls until an operator acts in the Review Queue |
| QUARANTINE | approved | calls your signer |
| QUARANTINE | denied | throws `Denied` / `DeniedError` (a subclass of Blocked) |
| QUARANTINE | still pending after max wait | throws `ReviewTimeout` / `ReviewTimeoutError` |

`check()` returns the verdict without signing, if you want to handle decisions yourself. The verdict
carries `operator_summary`, the Gate 1 checks, Gate 2's assessment, chain evidence and the full trace.

Polling defaults to every 5 seconds for up to 30 minutes (`poll_every` / `max_wait` in Python,
`pollEveryMs` / `maxWaitMs` in TypeScript).

## Failing closed

By default an unreachable shield, a timeout, a rate limit (HTTP 429) or a response without a decision
raises `ShieldUnavailable` and nothing is signed. `fail_closed=False` / `failClosed: false` signs without
a verdict in that case and logs a warning. Bad requests and payment errors never fall through to signing.

Agent mode (`mode="agent"`) runs the full Strands investigation and takes 10 to 40 seconds. The public
demo allows 8 agent runs per 10 minutes per client; fast mode is unlimited.

## Paying per check with x402

The free `/api/rpc` route is for the demo. External agents can pay per check instead: $0.001 for fast mode,
$0.01 for agent mode, in USDC on Base Sepolia, with no account or API key. The TypeScript client takes any
fetch, so wrap it with [x402-fetch](https://www.npmjs.com/package/x402-fetch) (not a dependency of this SDK):

```ts
import { wrapFetchWithPayment } from "x402-fetch";

const payingFetch = wrapFetchWithPayment(fetch, walletClient, 20_000n); // cap: $0.02
const shield = new Shield({ paid: true, fetch: payingFetch });
```

With `paid: true` the client posts the bare request to `/api/v1/shield` or `/api/v1/shield/agent`.
Review polling still goes through `/api/rpc`. See `scripts/paying-agent.mjs` in the repo root for a full
buyer. The Python client does not do x402 yet.

## Tests

```bash
cd sdk/python && python -m venv .venv && .venv/bin/pip install -e '.[test]' && .venv/bin/pytest -q
cd sdk/typescript && npm install && npm test
```

## Example

```bash
cd sdk/typescript && npm install && cd ../..
node sdk/examples/trading-bot.mjs               # drainer approval + clean swap
node sdk/examples/trading-bot.mjs --quarantine  # also a first-seen vault that waits for review
```
