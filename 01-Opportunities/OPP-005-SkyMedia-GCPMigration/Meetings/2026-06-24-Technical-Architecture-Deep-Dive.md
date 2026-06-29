# Meeting: Technical Architecture Deep Dive

**Date:** 2026-06-24
**Title:** Technical Architecture Deep Dive
**Opportunity:** GCP Migration
**Attendees:** Raj Patel(DevOps Lead), Lisa Chang(VP Infrastructure), Jayden(SA)
**Venue:** Online

## Agenda
- Firestore migration strategy for DynamoDB tables
- Cloud Run autoscaling configuration for media workloads
- CDN edge caching rules and cache invalidation policy
- Data residency compliance check for APAC regions

## Requirements
- GCP Cloud CDN 99.99% availability SLA — [Open] — Due 2026-08-15
- Data residency enforcement within Singapore for primary workload — [Open] — Due 2026-07-15

## Questions
### Q: What is the acceptable cache invalidation delay for live streaming metadata?
A: Raj: Under 30 seconds is acceptable

## Risks
- **Firestore lacks equivalent DynamoDB streaming features:** Exploring Cloud Functions + Pub/Sub as alternative event pipeline

## Action Items
- — Jayden — Create Firestore migration mapping document for 12 DynamoDB tables — Due 2026-06-28 — [Open]
- — Raj Patel — Configure Cloud Run autoscaling proof of concept — Due 2026-06-30 — [Open]
