# AgentShield — Full status for NOKARA continuation

Last updated: **2026-09-13** (session that built the share zip)  
Entrant org: **NOKARA Labs**  
Hackathon: **Agents for Humans** · Track: **Professional Agents** · Deadline: **Sep 14, 2026 5:00pm PT**

---

## 1. Executive truth table

| Area | State | Notes |
|------|--------|--------|
| Idea selection | **Done** | AgentShield × CTI-Agent (not Naija Remit) |
| Strands Agents SDK | **Done** | Installed + used in `agent/` with 7 `@tool`s |
| Deterministic firewall + Attack Lab | **Done** | **6/6** scenarios match expected |
| Flight Recorder UI | **Done** | Restyled charcoal `#0a0a0a` + crimson `#ef4444` |
| MIT LICENSE | **Done** | `LICENSE` |
| Architecture diagram | **Done** | `docs/architecture.svg` |
| README / handoff docs | **Done** | This pack |
| AWS account | **Done (team)** | Created; Bedrock access **not verified on build machine** |
| Devpost registration | **NOT DONE** | NOKARA owner must Join (see `START_HERE.md`) |
| Live Strands LLM loop (Bedrock/XAI) | **NOT DONE** | No model keys on build host → `strands_ready: false` |
| Public GitHub repo | **NOT DONE** | Must be public for submission |
| Demo video ≤5 min | **NOT DONE** | Required |
| Devpost submission form | **NOT DONE** | After join + materials |
| Live demo hosting | **NOT DONE** | Optional but helps Technical Implementation |
| AgentCore deploy | **NOT DONE** | Optional; strengthens score |
| builder.aws.com bonus post | **NOT DONE** | Optional +0.6 |
| $50 AWS credits | **MISSED / N/A** | Form closed Sep 11; not required |

---

## 2. Why we built this (context for the agent / teammate)

### Research → idea

Competitive research showed:

- Crowded: DeFAI / yield / trading agents.
- Empty: **agent wallet security / prompt-injection firewalls**.
- Judges reward foundational security primitives.
- Playbook idea **B1 “Chokepoint”** (firewall between AI agent and money) merged with CTI / honeypot checks → **AgentShield × CTI-Agent**.

### Hackathon pivot (critical)

Initial framing mixed Elastic SOC + crypto. Official rules are **Agents for Humans**:

- **Must** use **Strands Agents SDK**.
- Must do **real work for real people**, not chat wrappers.
- Three tracks → we locked **Professional Agents**.
- Submission needs public repo, MIT/Apache, README, architecture diagram, video, AWS Builder ID.

A Next-only firewall **would fail Stage One**. We rebuilt the core as a Strands agent in Python; Next.js is the Flight Recorder UI that proxies to it.

### UI inspo

Screenshots from the teammate’s machine (`Downloads/Agentshield`) showed a Tare-like dark SOC:

- Charcoal canvas, **crimson** CTAs, grain, large serif display, Flight Recorder density.

We **kept the colors/layout energy**, generated **new** mark + hero assets, filled with **AgentShield / NOKARA** copy — did **not** copy Tare branding.

---

## 3. What was built (inventory)

### A. Strands agent (source of truth for judging)

Path: `agent/`

| File | Role |
|------|------|
| `agentshield.py` | `strands.Agent` factory, system prompt, `invoke_*` |
| `tools.py` | 7 `@tool`s: injection, honeypot, CTI, gate1, gate2, finalize, notify |
| `shield_core.py` | Deterministic Gate1/Gate2/CTI/Elastic logic used by tools |
| `model.py` | Bedrock → SpaceXAI → OpenAI → none |
| `scenarios.py` | Attack Lab A1–A6 |
| `server.py` | FastAPI `:8000` — `/health`, `/shield`, `/demo/attack`, `/agent/invoke`, `/telemetry` |
| `cli.py` | `python -m agent.cli attack --all` / `health` / `run` |
| `requirements.txt` | `strands-agents[openai]`, tools, fastapi, etc. |

**Verified:** `python -m agent.cli attack --all` → **score 6/6**.

| Scenario | Expected | Result |
|----------|----------|--------|
| A1 Morse stego in metadata | BLOCK | BLOCK |
| A2 Honeypot swap | BLOCK | BLOCK |
| A3 Unlimited approve → drainer | BLOCK | BLOCK |
| A4 Jailbreak in tool output | BLOCK | BLOCK |
| A5 Clean Uniswap swap | ALLOW | ALLOW |
| A6 Novel contract | QUARANTINE | QUARANTINE |

### B. Flight Recorder UI

Path: `src/` (Next.js 15 + Tailwind 4)

- Landing: `/` — NOKARA branding, crimson accents, hero atmosphere
- SOC: `/soc` — Attack Lab, Live verdicts, Elastic Docs, CTI Feed
- API routes **proxy** to Python agent (`AGENT_API_URL`, default `http://127.0.0.1:8000`)

### C. Legacy / parallel TypeScript shield libs

Path: `src/lib/shield|cti|demo|elastic`

Early Next-native firewall. **Still in tree** but **runtime path is Python**. Do not delete yet (useful reference); do not treat as the Strands submission core. Prefer `agent/` for all judging narrative.

### D. Contracts (scaffolds only)

- `contracts/QuerySettlement.sol` — x402-style pay-per-query
- `contracts/ReputationRegistry.sol` — stake-weighted CTI reputation  

**Not deployed.** Fine for architecture story; not required for Stage One.

### E. Brand / design tokens

| Token | Value |
|-------|--------|
| Canvas | `#0a0a0a` |
| Crimson / BLOCK / CTA | `#ef4444` |
| Allow | `#22c55e` |
| Quarantine | `#f5a524` |
| Display font | Instrument Serif italic |
| Mark | `public/agentshield-mark.svg` (+ `brand-mark.jpg`) |
| Hero | `public/hero-atmosphere.jpg` |

---

## 4. What we deliberately did **not** finish

1. **Devpost Join** as NOKARA — waiting on Labs account owner.
2. **Bedrock credentials on the build machine** — AWS account exists, but CLI/model access not configured here → live `Agent(...)` LLM loop untested with Bedrock.
3. **Public GitHub** — `gh` is logged in as `Rahmandefi` on the build machine; repo not created/pushed yet.
4. **Demo video**.
5. **Devpost “Enter a Submission” form**.
6. **Production hosting** (Vercel / EC2 / AgentCore).
7. **AgentCore** packaging.
8. **On-chain deploy** of Solidity scaffolds.
9. **Browser E2E screenshots** — Playwright Chrome missing `libnss3` on the Linux host; verified via API + HTML instead.
10. **builder.aws.com** bonus article.

---

## 5. How To Enter — compliance vs rules

| Rule step | Status |
|-----------|--------|
| Join hackathon on Devpost | **Pending NOKARA** |
| AWS account | **Yes (created)** |
| Install Strands Agents SDK | **Yes** (in project venv / requirements) |
| Build agent that does real work | **Yes (demoable)** |
| $50 credits form by Sep 11 | **Missed** — optional, ignore |
| Public repo + MIT + README + architecture | **Partial** — files exist; **repo not public** |
| Video + pitch | **Missing** |
| AWS Builder ID on form | **Missing** |

---

## 6. Continue-from playbook (ordered)

### A. Today — NOKARA owner (non-code)

1. Join Devpost with the register link in `START_HERE.md`.
2. Enable Bedrock model access in AWS console.
3. Confirm eligibility (check excluded countries list on Devpost if relevant).

### B. Local verify (anyone with this zip)

```bash
cd agentshield
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r agent/requirements.txt
python -m agent.cli attack --all                    # must print score 6/6
python -m agent.server                              # leave running

# other terminal
npm install && npm run build && npm start
# open http://localhost:3000/soc → Run all
```

### C. Make Strands “live” for judges

```bash
aws configure
# or: set XAI_API_KEY=...
curl http://127.0.0.1:8000/health
# want: "strands_ready": true, "model_provider": "bedrock" | "spacexai"
python -m agent.cli attack --id A1_MORSE_INJECTION --strands
```

### D. Public repo

```bash
cd agentshield
git init   # if needed
git add .
git commit -m "AgentShield: Strands professional agent for Agents for Humans"
gh repo create agentshield --public --source=. --remote=origin --push
# Ensure LICENSE shows in GitHub About; set website to demo if hosted
```

### E. Video (≤ 5 min)

Follow `HACKATHON.md` demo script. Must cover problem / who / why + working Attack Lab. Upload to YouTube/Vimeo **public**.

### F. Submit on Devpost

- Track: Professional Agents  
- Paste description from section 8 below  
- Repo URL, architecture diagram, video, Builder ID  
- Optional live demo  

---

## 7. Architecture (short)

```
Human operator
    │
Trading agent ── proposes tx + provenance ──► Strands AgentShield
                                              │  tools: injection, honeypot,
                                              │  CTI, gate1, gate2, finalize,
                                              │  notify
                                              ▼
                                    ALLOW / BLOCK / QUARANTINE
                                              │
                              Flight Recorder UI + Elastic JSON
```

Model order (`agent/model.py`): **Bedrock → SpaceXAI → OpenAI → none**.

---

## 8. Paste-ready Devpost description (draft)

**Name:** AgentShield  

**Tagline:** Stop the agent before it signs the drain.

**Description:**

AgentShield is a Strands Agents professional agent built by NOKARA Labs for people who run autonomous trading and ops agents. Prompt injection and honeypot contracts can hijack an agent wallet even when the human’s intent was a normal swap. Chat-layer warnings fail; limits must sit between the agent and the signer.

AgentShield investigates every proposed transaction using a dual-gate design: Gate 1 is deterministic (caps, lists, Morse/stego injection scans, honeypot and drainer IOCs). Gate 2 is an adversarial reviewer that sees only the proposed transaction and provenance—never the trading agent’s private chat. A CTI feed and Elastic-ready security events power the Flight Recorder SOC console. The agent only surfaces the human on BLOCK or QUARANTINE.

Built with the Strands Agents SDK (Python), Amazon Bedrock–ready model routing, FastAPI, and a Next.js Flight Recorder. Attack Lab: six scenarios including Morse-code metadata injection, honeypot swaps, unlimited approve-to-drainer, and clean ALLOW paths—all matching expected verdicts.

**Track:** Professional Agents  

---

## 9. Known technical caveats

- **Dual codebase:** TypeScript `src/lib/shield*` is legacy; **Python `agent/` is canonical** for Strands judging.
- **In-memory Flight Recorder:** verdicts reset when the Python process restarts.
- **Demo addresses:** honeypots/drainers are synthetic IOCs for the lab, not live chain crawls.
- **Solidity:** scaffolds only.
- **Windows teammates:** use `.venv\Scripts\activate`; Node 20+; Python 3.10+.
- **Zip excludes** `node_modules`, `.venv`, `.next`, and inspo screenshots — run `npm install` / `pip install` after unzip.

---

## 10. Decision log (so you don’t re-debate)

| Decision | Choice | Why |
|----------|--------|-----|
| Winning idea | AgentShield × CTI | Security gap; Professional Agents fit |
| Not building | Naija Remit AI | Stretch only; weaker Strands/SOC story for this hackathon |
| Track | Professional Agents | Operators running agents |
| Entrant | NOKARA Labs | Team Labs account will Join |
| SDK | Strands Python | Hard requirement |
| UI palette | Charcoal + crimson | Teammate inspo screenshots |
| Brand | AgentShield (not Tare) | New mark/copy |

---

## 11. Contacts / accounts on the build machine (FYI)

- GitHub CLI authenticated as **`Rahmandefi`** (may or may not be the NOKARA org account — confirm before push).
- No AWS CLI installed on the Linux build host at last check; Windows Labs machine may differ.

---

## 12. Definition of “ready to submit”

- [ ] Devpost shows NOKARA registered  
- [ ] `attack --all` → 6/6 on a clean machine from this zip  
- [ ] `/health` → `strands_ready: true` with Bedrock (preferred)  
- [ ] Public GitHub with MIT + README + architecture SVG  
- [ ] Public demo video with pitch + working UI  
- [ ] Devpost submission form completed under Professional Agents before deadline  

Until those boxes are checked, the project is **build-complete / entry-incomplete**.
