# Meeting: GCP Architecture Workshop

**Date:** 2026-05-20
**Title:** GCP Architecture Workshop
**Opportunity:** GCP Migration
**Attendees:** Kevin Tan (CTO), Lisa Chang (VP Infrastructure), Benedict
**Venue:** Physical

## Agenda
- Current infrastructure pain points and scaling bottlenecks
- GCP vs AWS cost comparison for media workloads
- CDN and edge caching strategy on GCP
- Data residency requirements for APAC regions

## Requirements
- GCP Cloud CDN with 99.99% availability SLA — [Open] — Due 2026-08-15
- BigQuery integration for real-time viewer analytics — [Open] — Due 2026-09-01
- Multi-region deployment across Singapore, Tokyo, Sydney — [Gap] — Due 2026-07-30

## Questions
### Q: What is the current CDN monthly cost?
A: Approximately $180K/month on AWS CloudFront

### Q: Is there a mandate to move off AWS?
A: No mandate, but cost pressure from board to optimize

## Risks
- **AWS lock-in with existing Lambda and DynamoDB workloads:** Phase migration over 12 months using GCP transfer service
- **APAC data residency not available for all GCP services:** (no mitigation yet)

## Action Items
- — Benedict — Prepare GCP cost simulation for current workload — Due 2026-05-27 — [Completed]
- — Lisa Chang — Lisa to share current architecture diagrams — Due 2026-05-30 — [Completed]
- — Kevin Tan — Kevin to introduce procurement lead for pricing discussion — Due 2026-06-05 — [Open]
