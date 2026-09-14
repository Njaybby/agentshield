# START HERE — NOKARA Labs / AgentShield

**Read this file first.** Everything else hangs off it.

| | |
|--|--|
| **Product** | AgentShield × CTI-Agent |
| **Team / entrant** | **NOKARA Labs** |
| **Hackathon** | [Agents for Humans](https://agentsforhumans.devpost.com/) (AWS × Devpost) |
| **Track** | **Professional Agents** |
| **Hard deadline** | **Monday, Sep 14, 2026 — 5:00 pm Pacific** |
| **Required SDK** | [Strands Agents](https://strandsagents.com/) (Python) |

### Join Devpost (you — Labs account owner)

Use this exact link (bare homepage sometimes 404s):

**https://agentsforhumans.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=30317&flow%5Bname%5D=register_for_challenge**

Backup: https://devpost.com/hackathons?organization=Amazon → **Agents for Humans Hackathon** → Join.

---

## Doc map (what to open next)

| File | Purpose |
|------|---------|
| **`START_HERE.md`** | This file — orientation |
| **`STATUS.md`** | Done / missed / blocked / continue-from (truth table) |
| **`TEAM_HANDOFF.md`** | Your signup + submit actions |
| **`HACKATHON.md`** | Pitch, demo script, judging fit |
| **`README.md`** | How to run the project |
| **`docs/architecture.svg`** | Architecture diagram (submission requirement) |
| **`LICENSE`** | MIT (submission requirement) |
| **`.env.example`** | Env vars for Bedrock / SpaceXAI |

---

## 60-second product pitch

Autonomous trading agents get **prompt-injected** (e.g. Morse in token metadata) and steered into **honeypots / unlimited approvals**. Chat-layer “be careful” fails.

**AgentShield** is a Strands **professional agent** that sits between the trading agent and the signer:

1. Reads **intent + provenance + proposed tx** (never the trading agent’s private chat).
2. Runs **Gate 1** (deterministic) + **Gate 2** (adversarial) + **CTI**.
3. Returns **ALLOW / BLOCK / QUARANTINE**, logs an Elastic-ready event, notifies the human only when needed.

Attack Lab demo: **6/6** expected outcomes (including Morse → BLOCK, clean swap → ALLOW).

---

## How to run (after unzip)

```bash
# 1) Python Strands API
cd agentshield
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r agent/requirements.txt
python -m agent.cli attack --all          # expect score 6/6
python -m agent.server                    # http://127.0.0.1:8000

# 2) UI (second terminal)
npm install
npm run build && npm start                # http://localhost:3000
# Flight Recorder / Attack Lab: http://localhost:3000/soc
```

UI proxies to the agent at `AGENT_API_URL` (default `http://127.0.0.1:8000`).

### Model keys (for live Strands LLM loop — preferred for judging)

```bash
# Best for AWS judging — Bedrock
aws configure
# Console: Bedrock → Model access → enable Claude Sonnet (e.g. us-west-2)

# Or SpaceXAI
set XAI_API_KEY=your_key
```

Without keys: Attack Lab still works (deterministic tools). Health will show `"strands_ready": false`.

---

## Immediate priority list for NOKARA owner

1. [ ] Join Devpost as **NOKARA Labs** (link above)
2. [ ] Confirm AWS account + **Bedrock model access**
3. [ ] Unzip, run Attack Lab **6/6**, open `/soc`
4. [ ] Push **public GitHub** (MIT visible in About) — not done yet
5. [ ] Record **≤5 min video** (problem / who / why + working demo)
6. [ ] Submit on Devpost before **Sep 14 5pm PT** — track **Professional Agents**
7. [ ] Optional: live demo URL; builder.aws.com post titled with **Agents for Humans**

**Do not bother:** $50 AWS credits form — closed Sep 11; optional anyway.

---

## One-line status

> **Code is demoable and Strands-shaped. Entry/submit process is not finished.** Devpost join + public repo + video + Bedrock live loop + Devpost form remain.
