# Meeting: Reference Architecture Review and Site Visit

**Date:** 2026-06-12
**Title:** Reference Architecture Review and Site Visit
**Opportunity:** Azure IoT Platform
**Attendees:** Hans Mueller (CIO), James Cooper (Cloud Architect), Benedict
**Venue:** Physical

## Agenda
- Walk through Azure IoT reference architecture
- Site visit to understand physical constraints
- Discuss Azure Digital Twins for refinery simulation
- Review security and compliance framework

## Requirements
- Azure Digital Twins for 3D refinery simulation — [Open] — Due 2027-Q1
- Azure Sphere for secure device management — [Open] — Due 2026-12-01
- Real-time anomaly detection with Azure Monitor — [Open] — Due 2027-Q2

## Questions
### Q: Can Azure Digital Twins model the entire refinery?
A: Yes, we can create a full digital twin with live sensor feeds

### Q: What is the disaster recovery plan for edge devices?
A: Azure IoT Edge supports local store-and-forward with auto-sync

## Risks
- **Refinery union concerns about IoT replacing manual monitoring jobs:** Position IoT as augmenting workers, not replacing — create new digital operator roles
- **IEC 62443 compliance gap — Azure IoT Hub not yet certified:** (no mitigation yet)

## Action Items
- — Benedict — Deliver updated architecture with security compliance overlay — Due 2026-06-20 — [In Progress]
- — James Cooper — James to provision Azure trial environment for PetroEdge team — Due 2026-06-25 — [Open]
- — Hans Mueller — Hans to initiate compliance discussion with TUV — Due 2026-07-01 — [Open]
