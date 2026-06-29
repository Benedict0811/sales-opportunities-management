# Meeting: GCP Pricing and Migration Review

**Date:** 2026-06-10
**Title:** GCP Pricing and Migration Review
**Opportunity:** GCP Migration
**Attendees:** Kevin Tan (CTO), Raj Patel (DevOps Lead), Benedict
**Venue:** Online

## Agenda
- Review GCP cost simulation results
- Discuss migration phasing for Lambda workloads
- Agree on POC scope for CDN migration
- Timeline and procurement next steps

## Requirements
- GCP committed use discount for 3-year term — [Open] — Due 2026-08-15
- Cloud Run migration for 12 Lambda functions — [Open] — Due 2026-10-01
- Firestore replacement for DynamoDB tables — [Gap] — Due 2026-11-01

## Questions
### Q: Can we run POC on GCP without impacting production?
A: Yes, we can mirror traffic to GCP CDN for testing

### Q: What is the committed spend required for best pricing?
A: $200K/year commitment gives 20% discount on compute

## Risks
- **DynamoDB to Firestore migration has no automated tooling:** Build custom migration scripts with checkpointing
- **Procurement team unfamiliar with GCP contract terms:** Provide side-by-side comparison with AWS agreement

## Action Items
- — Benedict — Send GCP POC environment setup guide — Due 2026-06-15 — [Completed]
- — Raj Patel — Raj to identify top 5 Lambda functions for POC — Due 2026-06-20 — [Open]
- — Benedict — Schedule procurement meeting with Kevin and finance — Due 2026-06-25 — [Open]
