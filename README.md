# AgentShield × CTI-Agent

**NOKARA Labs** · Professional Agents track — [Agents for Humans](https://agentsforhumans.devpost.com/) (AWS × Devpost)

A [Strands Agents](https://strandsagents.com/) professional agent that does real pre-trade security work for people who run autonomous trading / ops agents: it investigates proposed transactions, blocks prompt-injection drains and honeypots, and only surfaces the human when judgment is required.

## If you received the share zip

1. **[`START_HERE.md`](START_HERE.md)** — orientation + join link + run commands  
2. **[`STATUS.md`](STATUS.md)** — everything done, missed, and how to continue  
3. **[`CONTINUATION_CHECKLIST.md`](CONTINUATION_CHECKLIST.md)** — tick boxes  
4. **[`TEAM_HANDOFF.md`](TEAM_HANDOFF.md)** — NOKARA owner Devpost/AWS/submit steps  

Deadline: **Sep 14, 2026 · 5:00 pm Pacific**.

> Stop the agent before it signs the drain.

## Why this (judging fit)

| Criterion | How we hit it |
|-----------|----------------|
| **Strands Agents (required)** | Core loop in `agent/` using `strands.Agent` + `@tool` security tools |
| **Technical Implementation** | Multi-tool agent loop, Bedrock-first model provider, Elastic-ready telemetry, live Attack Lab |
| **Design** | Cyber-Feline Flight Recorder SOC (`/soc`) — complete product experience |
| **Potential Impact** | Prompt-injection stole ~$204k from a live agent wallet; defensive submissions are nearly nonexistent |
| **Creativity** | Dual-gate architecture: deterministic Gate 1 (non-bypassable) + adversarial Gate 2 that never sees chat |

## Architecture

See [`docs/architecture.svg`](docs/architecture.svg).

```
Human intent → Trading agent proposes tx + provenance
                    ↓
         Strands AgentShield loop (Bedrock / SpaceXAI)
           ├─ Gate 1 tools (deterministic)
           ├─ Gate 2 tools (adversarial)
           ├─ CTI lookup
           └─ finalize + notify operator
                    ↓
         ALLOW / BLOCK / QUARANTINE → Flight Recorder + Elastic doc
```

Optional: Amazon Bedrock AgentCore deployment strengthens Technical Implementation (not required).

## Quick start

### 1) Strands agent API (required)

```bash
cd agentshield
python3 -m venv .venv && source .venv/bin/activate
pip install -r agent/requirements.txt

# Model (pick one):
# A) Amazon Bedrock (preferred for AWS judging)
export AWS_REGION=us-west-2
# aws configure   # enable Claude Sonnet access in Bedrock

# B) SpaceXAI (OpenAI-compatible) for local demo
export XAI_API_KEY=...

# Deterministic Attack Lab works even without a model key:
python -m agent.cli attack --all

# Start Strands API
python -m agent.server
# → http://127.0.0.1:8000/health
```

### 2) Flight Recorder UI

```bash
npm install
npm run build && npm start
# Overview:  http://localhost:3000
# SOC:       http://localhost:3000/soc
```

Set `AGENT_API_URL=http://127.0.0.1:8000` if the agent API is elsewhere.

## Attack Lab (measurable demo)

| ID | Expected | Story |
|----|----------|-------|
| `A1_MORSE_INJECTION` | BLOCK | Morse stego in token metadata |
| `A2_HONEYPOT_SWAP` | BLOCK | CTI-listed honeypot |
| `A3_UNLIMITED_APPROVE` | BLOCK | Unlimited approve to drainer |
| `A4_INSTRUCTION_OVERRIDE` | BLOCK | Jailbreak phrase in tool output |
| `A5_CLEAN_SWAP` | ALLOW | Legitimate Uniswap swap |
| `A6_NOVEL_CONTRACT` | QUARANTINE | First-seen counterparty |

```bash
python -m agent.cli attack --all
# With live Strands LLM loop (needs model key):
python -m agent.cli attack --id A1_MORSE_INJECTION --strands
```

## Repository map

| Path | Role |
|------|------|
| `agent/` | **Strands Agents SDK** professional agent + FastAPI |
| `src/` | Next.js Flight Recorder SOC UI |
| `contracts/` | x402 QuerySettlement + ReputationRegistry scaffolds |
| `docs/architecture.svg` | Architecture diagram (submission requirement) |
| `HACKATHON.md` | Pitch / demo script / track notes |

## Submission checklist (Agents for Humans)

- [x] Built with **Strands Agents SDK**
- [x] **Professional Agents** track
- [x] MIT `LICENSE`
- [x] README + architecture diagram
- [ ] Public GitHub/GitLab URL
- [ ] Demo video ≤ 5 min (problem / who / why + working demo)
- [ ] AWS Builder ID on Devpost form
- [ ] Optional: live demo link
- [ ] Optional bonus: builder.aws.com post titled with **Agents for Humans**

## License

MIT
