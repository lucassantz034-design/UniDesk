---
id: SPEC-unidesk-licensing-control-plane
companions:
  - '_bmad-output/planning-artifacts/architecture/architecture-UniDesk-2026-10-13/ARCHITECTURE-SPINE.md'
sources:
  - '_bmad-output/specs/spec-unidesk-licensing-control-plane/.memlog.md'
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# UniDesk Licensing, Billing & Central Control Plane

## Why

To monetize UniDesk sustainably as an on-premise/hybrid SaaS product, we must guarantee payment compliance and license security without burdening client network administrators with firewall holes or incurring early fixed infrastructure costs for the SaaS operator. This specification establishes the automated recurring billing loop (Asaas), asymmetric cryptographic license enforcement (Ed25519) with a 15-day grace period, and vendor-tier support ticket management inside a centralized Control Plane.

## Capabilities

- **CAP-1**
  - **intent:** The Central Control Plane receives and processes real-time webhook events from Asaas (payment confirmation, overdue bills, cancellations) to immediately update company subscription records.
  - **success:** Simulating `PAYMENT_RECEIVED` and `PAYMENT_OVERDUE` webhooks from Asaas alters the tenant status in the Central PostgreSQL database between `ACTIVE` and `GRACE_PERIOD` within 2 seconds.

- **CAP-2**
  - **intent:** The Central API generates mathematically tamper-proof Ed25519 signed license JWTs and verifies outbound heartbeat requests from client instances.
  - **success:** A client instance calling `POST /api/v1/license/heartbeat` with valid credentials receives a signed JWT with expiration timestamp and status that validates successfully against the embedded Ed25519 public key.

- **CAP-3**
  - **intent:** The UniDesk local runtime enforces license health with a 15-day grace period, displaying an admin warning banner on overdue status and fully locking operational routes on day 16.
  - **success:** In overdue state (days 1-15), student/attendant operations work and only admins see the billing warning; on day 16+, all API endpoints return HTTP 402 and the UI displays the blocking modal with Asaas Pix/Boleto invoice details.

- **CAP-4**
  - **intent:** Local UniDesk administrators can open technical support tickets addressed to the software vendor directly from the local Admin portal, attaching diagnostic runtime telemetry.
  - **success:** Submitting a ticket from the local UniDesk Admin portal dispatches an outbound HTTPS payload to the Central API and renders the ticket in the Master Support Dashboard with attached system diagnostics (runtime version, database engine, error log sample).

- **CAP-5**
  - **intent:** The SaaS administrator can view and manage all client companies, active licenses, recurring payments, and incoming support tickets in a unified Master Admin Web Dashboard.
  - **success:** Navigating to `/control-plane/frontend` authenticated as master admin allows searching companies, viewing subscription status, issuing manual license extensions, and replying to support tickets.

## Constraints

- Strictly outbound HTTPS communication from client instances to Central API (zero client inbound ports or firewall configurations).
- Central Control Plane database must be free-tier PostgreSQL (Supabase or Neon) with zero idle hosting cost.
- Client database must remain decoupled via Database Adapter (SQLite default for on-premise, PostgreSQL/MySQL for cloud/AWS).
- 15 days of grace warning before enforcing total software lockout.

## Non-goals

- Self-service billing portal hosted publicly for end-clients (clients pay directly via Asaas link/Pix in-app or via Asaas transactional emails).
- Automatic Over-The-Air (OTA) binary updates pushed from Central to client servers (updates remain manual/container-based).

## Success signal

A new tenant company is registered with an Asaas subscription; the local UniDesk instance starts with SQLite, activates its license via the Central Control Plane, validates daily heartbeats, receives an overdue alert during the 15-day grace period, and locks on day 16 until an Asaas webhook confirms payment and restores normal operation within 60 seconds.
