# Meeting Briefing — Softspace-Open AI

## Deal Health
**Risk Level**: 🔴 RED
**Core Risk**: The POC Result Review meeting is imminent, but key POC deliverables are not ready — testing report is still in progress, POC account setup is overdue by 5 days, and the data residency architecture has no solution to present. Any one of these blocking will turn the review into an embarrassing "we are not ready yet" conversation.
**Evidence**:
1. POC account & token quota configuration (Jayden, due 06-24) — **Delayed 5 days**. Client may already be experiencing a degraded POC trial.
2. POC testing scenarios & results report (Sam, due 06-28) — **In Progress** with less than 1 day of buffer before the meeting.
3. Data residency in Malaysia DC [Gap, UNCOVERED] — **Zero actions** are driving this, yet Agenda Item #3 demands a discussion on it.

**If unresolved**: If the 06-29 meeting fails to deliver complete POC results and an architecture proposal, Ali and Abu will question our execution capability. Jimmy, currently Neutral, will not shift to Supporter — and without internal advocacy, the 30k POC-to-production deal will stall indefinitely in Discovery.

## Last Meeting → Next Meeting Thread
- **Last meeting**: 2026-06-22 — NDA Signing and POC Kickoff
- **Decided**: NDA signed, POC scope & timeline aligned, Vibe coding demo completed
- **Left unresolved**: Monthly POC token consumption estimate (Open), Vibe coding test data from client side (Open), Azure Malaysia region availability for GPT5.5 (Risk, no mitigation), Azure data training policy clarity (Risk, partial mitigation)
- **This meeting MUST close**: (1) POC test results must be delivered (2) Data residency architecture must be presentable (3) Azure region availability must be confirmed or workaround proposed

## Critical Path
| # | Item | Type | Owner | Due | Why Critical |
|---|------|------|-------|-----|-------------|
| 1 | POC testing scenarios & results report | Action (OVERDUE) | Sam | 06-28 | Primary input for the review — no report, no review |
| 2 | Data residency in Malaysia DC | Gap (UNCOVERED) | Nobody | 07-01 | Agenda Item #3 expects a discussion; we have nothing to present |
| 3 | Azure GPT5.5 Malaysia region availability | Risk (UNADDRESSED) | Nobody | — | Agenda Item #5 expects confirmation; no mitigation or workaround |

**Items NOT on critical path (can defer this meeting)**: Monthly token consumption estimate (Open Question, does not affect POC review conclusion), Vibe coding test data from Softspace (client-side dependency, outside our control)

## Blind Spots
1. **Data residency in Malaysia DC [Gap, UNCOVERED]** — No action exists to design a compliance architecture. Due date 07-01 is 2 days after the meeting. **Consequence**: Agenda Item #3 will have no content. Client will perceive we are not taking compliance seriously — directly undermines Jimmy's confidence in our professionalism.
2. **Azure GPT5.5 Malaysia region availability [Risk, UNADDRESSED]** — Agenda Item #5 requires confirmation. **Consequence**: If GPT5.5 is not available in Malaysia, we must immediately propose a Singapore endpoint + data-at-rest-in-Malaysia architecture. Without this prepared, we cannot answer a core production deployment question.
3. **POC account setup [Action, OVERDUE by 5 days]** — Jayden's task is Delayed. **Consequence**: Client may have already experienced a poor POC trial (insufficient quota or permission issues) and could voice dissatisfaction during the review.

## Open Requirements
| # | Requirement | Status | Due | Covered? |
|---|-------------|--------|-----|----------|
| 1 | Open AI token quota for POC | Open | — | ⚠️ Partial — Jayden Delayed on account setup |
| 2 | Data residency in Malaysia DC | **Gap** | 07-01 | ❌ UNCOVERED — no action driving this |
| 3 | Azure region availability for production workload | Open | — | ❌ UNCOVERED — no action driving this |

## Open Action Items
| Owner | Action | Due | Status | On Critical Path? |
|-------|--------|-----|--------|------------------|
| Sam | POC testing scenarios and results report | 06-28 | In Progress | ✅ Yes — blocks the entire review |
| Jayden | POC account setup & token quota configuration | 06-24 | **Delayed** | ✅ Yes — affects POC user experience |
| Sam | NDA required before POC | 06-22 | Completed | — |

## Unmitigated Risks
1. **Azure GPT5.5 availability in Malaysia region** — No mitigation prepared. If unavailable, production deployment is blocked for the client's compliance requirement. Must propose Singapore endpoint workaround.
2. **Azure data training policy** — Partial mitigation (architecture proposal in progress). Client may refuse if their data is used for model training. Must confirm Azure's policy excludes customer data.

## Stakeholder Dynamics
- **Champion status**: **Missing.** Jimmy is the only logged stakeholder — High Influence, Neutral attitude. He is not advocating for us internally. Ali(CTO) and Abu(CEO) attend meetings but have no attitude recorded. This meeting must convert at least one of them to Supporter.
- **Blocker risk**: No Skeptic identified, but Jimmy's Neutral + DevOps Manager role = he cares about operational feasibility and data compliance. If data residency questions go unanswered, he will shift to Skeptic.
- **Action ownership signal**: Jayden (our SA) owns the overdue POC account setup — signals an internal delivery gap that must be fixed before the meeting. Sam's testing report is In Progress with tight deadline.
- **Key dynamic for this meeting**: Jimmy is the swing factor. If POC results satisfy him, he can shift from Neutral to Supporter and become our internal Champion. If the POC experience was degraded by the account delay, he will go Skeptic.

## Open Questions
1. What is the expected token consumption per month during POC? — **(open)** — Will likely come up; prepare a rough estimate based on POC scope
2. Can Softspace provide test data for the Vibe coding scenario? — **(open)** — Client-side dependency; push for a yes/no answer to unblock testing

## Game Plan
1. **Primary objective**: Get Ali or Abu to express satisfaction with POC results and commit to moving to Production scope discussion
2. **Secondary objective**: Get Jimmy to confirm the data residency architecture is acceptable and provide compliance team feedback
3. **Opening move**: Lead with POC test scenario results (all green) to build confidence in technical readiness — this gives Ali/Abu ammunition for internal approval
4. **Landmines**: Azure data training policy — if asked "Will our data be used to train Azure models?", answer definitively: **"No — Azure policy explicitly excludes customer data from model training."** Do not be vague; vagueness destroys trust
5. **The Ask**: (1) Ali confirms POC results are satisfactory and agrees to Production scope discussion (2) Jimmy confirms data residency proposal is acceptable and loops in compliance team
6. **Fallback**: If POC results are not satisfactory, request specific improvement items and a revised review date — avoid open-ended delays
7. **Pre-meeting actions**: [URGENT] Sam must finalize testing report by 06-28 | [URGENT] Jayden must confirm POC account is fixed and quota is adequate | [URGENT] Prepare data residency architecture draft (Singapore endpoint + data-at-rest in Malaysia) — even if rough, must have something to present

---

<details>
<summary>📋 Reference Data</summary>

## Full Stakeholder Map
| Name | Role | Influence | Attitude |
|------|------|-----------|----------|
| Jimmy | Devops Manager | High | Neutral |

Influence: High 1 | Medium 0 | Low 0
Attitude: Champion 0 | Supporter 0 | Neutral 1 | Skeptic 0

Note: Ali(CTO) and Abu(CEO) are meeting attendees but not logged in the stakeholder system. Their attitudes are unknown — a critical gap to address in this meeting.

## Current Status
- **Stage**: Discovery (4d)
- **Product**: Open AI | **Budget**: 30k | **Need**: AI Tokens
- **Target Close**: 2026-Q3
- **Next Action**: TBD — [In Progress]

</details>