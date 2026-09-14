# NOKARA Labs — Owner actions (signup + submit)

> Full technical continuity: **`START_HERE.md`** → **`STATUS.md`**.  
> This page is only what **you** (Labs account holder) must click / record / submit.

## Hackathon

| | |
|--|--|
| Name | Agents for Humans (AWS × Devpost) |
| Track | **Professional Agents** |
| Deadline | **Mon Sep 14, 2026 · 5:00 pm Pacific** |
| Entrant | **NOKARA Labs** |

## 1) Join Devpost NOW

**Join link (use this exact URL):**  
https://agentsforhumans.devpost.com/register?flow%5Bdata%5D%5Bchallenge_id%5D=30317&flow%5Bname%5D=register_for_challenge

If that fails: https://devpost.com/hackathons?organization=Amazon → Agents for Humans → Join.

Log in / create Devpost as the **NOKARA Labs** representative.

## 2) AWS (account already created)

1. Open AWS Console → **Amazon Bedrock** → **Model access**.  
2. Enable **Claude Sonnet** (or the Strands default Claude model) in `us-west-2` (or your region).  
3. On the machine that will demo: `aws configure` (or env keys).  
4. Confirm: `curl http://127.0.0.1:8000/health` shows `"strands_ready": true`.

**Ignore:** $50 credits form (closed Sep 11). Not required.

## 3) After builders push the public repo + video

On Devpost → Enter a Submission:

- [ ] Project name: **AgentShield**
- [ ] Track: **Professional Agents**
- [ ] Text description: paste draft from `STATUS.md` §8
- [ ] **Public** GitHub/GitLab/Bitbucket URL
- [ ] Confirm **MIT** `LICENSE` visible on repo
- [ ] README present
- [ ] Architecture diagram (`docs/architecture.svg` — upload or link)
- [ ] Demo video URL (YouTube/Vimeo public, ≤5 min)
- [ ] AWS Builder ID
- [ ] Optional: live demo URL
- [ ] Optional bonus: builder.aws.com post with **Agents for Humans** in the title

## 4) Video must include

1. Working demo (Attack Lab A1 BLOCK + A5 ALLOW + Run all 6/6).  
2. Pitch: **(1) problem (2) who (3) why it matters**.  
   Screen recording + voiceover is enough — no face required.

Script outline: `HACKATHON.md`.

## 5) What the zip already contains for your builders

- Full source (Strands agent + UI + contracts)  
- `STATUS.md` — done / missed / continue-from  
- `START_HERE.md` — run instructions  
- Architecture SVG, MIT license, pitch drafts  

They still need: `npm install`, `pip install -r agent/requirements.txt`, then run agent + UI.

## Questions for support

Devpost: support@devpost.com  
Rules: https://agentsforhumans.devpost.com/rules  
FAQs: https://agentsforhumans.devpost.com/details/faqs  
Resources: https://agentsforhumans.devpost.com/resources  
