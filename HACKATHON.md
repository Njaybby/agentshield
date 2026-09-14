# Agents for Humans — Submission Brief

**Hackathon:** [Agents for Humans](https://agentsforhumans.devpost.com/) (AWS × Devpost)  
**Deadline:** Monday, Sep 14, 2026 · 5:00 pm Pacific  
**Track:** **Professional Agents**  
**Required SDK:** [Strands Agents](https://strandsagents.com/)

## Pitch (problem / who / why)

1. **Problem:** Autonomous agents that can move money are being prompt-injected (Morse in metadata, jailbreak phrases in tool output) and steered into honeypots / unlimited approvals. Chat-layer “be careful” prompts fail; limits must sit between the agent and the signer.
2. **Who:** Professionals and operators who already run trading / ops agents — quants, on-chain desks, agent builders — and need a bodyguard that works while they sleep.
3. **Why it matters:** Documented live drains (~$204k Morse case; related router failures in the hundreds of millions). Defensive firewall submissions are nearly nonexistent while DeFAI clones flood the field.

## What the Strands agent does (real work, not chat)

1. Receives proposed tx + provenance (never the trading agent’s private chat).
2. Calls tools: injection scan, honeypot/drainer check, CTI lookup, Gate 1, Gate 2.
3. Finalizes ALLOW / BLOCK / QUARANTINE and writes an Elastic-ready security event.
4. Notifies the human only when the decision is BLOCK or QUARANTINE.

## Demo script (≤ 5 min video)

1. Show architecture diagram (`docs/architecture.svg`).
2. `python -m agent.cli attack --all` → **6/6** matched.
3. Open `/soc` Attack Lab → run **A1 Morse** → BLOCK with decoded payload.
4. Run **A5 Clean** → ALLOW.
5. Optional: with `XAI_API_KEY` or Bedrock creds, `python -m agent.cli attack --id A1_MORSE_INJECTION --strands` to show the live Strands tool loop.
6. Elastic Docs tab → SOC-ingestible JSON.

## Credentials

| Provider | Env | Notes |
|----------|-----|-------|
| Amazon Bedrock (preferred) | `AWS_*` / `aws configure` | Default Strands provider; enable Claude Sonnet |
| SpaceXAI | `XAI_API_KEY` | OpenAI-compatible via `https://api.x.ai/v1` |
| OpenAI | `OPENAI_API_KEY` | Fallback |

Attack Lab deterministic path works **without** a model key (same `@tool` implementations the Strands agent calls).

## Bonus

Publish on builder.aws.com with **Agents for Humans** in the title for up to +0.6 points.
