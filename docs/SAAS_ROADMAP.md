# SaaS Roadmap (Planned)
Last updated: 2026-02-20

Current implementation status audit: see `docs/SAAS_AUDIT.md`.

This document captures planning requirements to evolve the current LMS into a SaaS product. It is a roadmap and architecture planning document only.

## 1. Product Editions (Planned)

### Edition A: Self-Hosted Docker (Free)
- Distribution: public Docker image
- Audience: institutes/trainers who host on their own infra
- Branding model:
  - White-label enabled
  - Small mandatory product credit (for example footer/copyright mark)
- Setup expectation:
  - Guided setup wizard during first run
  - Configurable database backend (MongoDB or PostgreSQL)

### Edition B: Managed Cloud (Paid)
- Distribution: hosted by platform operator
- Audience: enterprises, institutes, trainers, individuals
- Onboarding:
  - 15-day full-feature trial
  - White-label options available
- Commercial model:
  - Plan tiers with entitlements and limits
  - Usage-based enforcement per plan

## 2. Business and Packaging Goals
- Keep core LMS feature parity across editions.
- Differentiate by operational convenience and commercial controls, not by breaking core learning flows.
- Maintain one codebase with edition flags and entitlement gates.

## 3. SaaS Capability Gaps vs Current System
Current product is largely single-tenant. To support both editions, the following platform layers are required:
- Tenant model and strict tenant data isolation
- Tenant-scoped RBAC and permission evaluation
- Subscription, billing, and entitlement services
- Metering and quota enforcement
- Tenant branding/domain/email identity management
- Tenant provisioning lifecycle (trial -> active -> suspended -> canceled)

## 4. Required Architecture Changes

### 4.1 Multi-Tenancy Foundation
- Add `tenantId` to tenant-scoped entities:
  - users, roles, courses, batches, enrollments, classes, assessments, submissions, resources, notifications, tickets, monitoring records
- Enforce tenant scoping in:
  - auth claims
  - route middleware
  - repository/query layer
- Add global platform entities:
  - `Tenant`
  - `Subscription`
  - `Plan`
  - `UsageMeter`
  - `TenantDomain`
  - `TenantBranding`

### 4.2 Edition and Feature Flag Layer
- Add an edition field (`self_hosted`, `managed_cloud`).
- Add feature flags and hard limits by plan.
- Add runtime guards for blocked features when limits are reached.

### 4.3 Database Strategy for Self-Hosted
- Requirement: setup wizard allows MongoDB URI or PostgreSQL selection.
- Needed implementation:
  - Persistence abstraction layer (repository/provider pattern)
  - Mongo adapter and Postgres adapter for core modules
  - Migration and seed pipeline for both engines
  - Compatibility matrix by version (minimum supported Mongo/Postgres versions)

Note:
- Dynamic DB switching after data exists is complex; preferred pattern is selecting one provider at setup time and locking it for that tenant instance.

### 4.4 Provisioning and Setup Wizard
Create first-run wizard for institute/coaching setup.

Common wizard steps (both editions):
- Institute profile (name, logo, contact, timezone)
- White-label branding (theme, favicon, login screen assets, app name)
- Admin account bootstrap
- Email delivery settings

Additional steps for self-hosted:
- Database type selection (`mongodb` or `postgres`)
- Connection validation and version checks
- Storage mode selection (local/S3 compatible)
- Optional SMTP and domain setup

Additional steps for managed cloud:
- Trial activation and tenant creation
- Starter plan default assignment
- Optional custom domain setup

### 4.5 Billing and Entitlement Engine (Managed Cloud)
- Plans with quota dimensions, for example:
  - max courses
  - max classes per course/month
  - max active students
  - assessment and storage limits
  - notification/email volume limits
- Subscription lifecycle:
  - trial start/end
  - upgrade/downgrade
  - renewal/cancellation
  - grace period/dunning
- Payment gateway integration:
  - invoices, receipts, retries, webhook reconciliation

### 4.6 Metering and Quota Enforcement
- Track usage counters per tenant and billing window.
- Enforce soft/hard limits in write paths.
- Show usage dashboards and warnings in tenant admin UI.

### 4.7 Custom Domain for Managed Cloud
Feasibility: **Yes, possible** with standard SaaS domain mapping architecture.

Required components:
- Domain registration flow in tenant settings
- DNS verification (TXT/CNAME)
- TLS certificate issuance/renewal automation
- Ingress routing by host header to tenant context
- Domain ownership checks and takeover protection

### 4.8 White-Labeling Model
- Tenant theme tokens (colors/typography)
- Logos and login assets
- App title and email templates
- Footer credit policy by edition/plan

### 4.9 Security, Compliance, and Ops
- Tenant-aware audit logs
- Data retention policies per tenant
- Backups and restore per tenant or per cluster policy
- Encryption at rest/in transit
- GDPR-style export/delete workflows (if required by target market)

## 5. Suggested Rollout Phases

### Phase 0: Platform Readiness
- Clean module boundaries
- Remove legacy UI remnants
- Increase automated test coverage for core LMS paths

### Phase 1: Tenant Core
- Tenant model, tenant-aware auth, tenant scoping enforcement
- Tenant bootstrap API and admin onboarding

### Phase 2: Edition A (Self-Hosted Docker)
- Docker packaging hardening
- First-run setup wizard
- Database provider selection and validation
- White-label baseline + mandatory small product credit

### Phase 3: Edition B (Managed Cloud)
- Trial lifecycle, plan model, billing integration
- Entitlement and quota enforcement
- Usage dashboards and overage handling

### Phase 4: Custom Domain and Advanced Branding
- Domain onboarding, certificate automation, host routing
- Advanced white-label controls and branding governance

### Phase 5: Scale and Governance
- Multi-region readiness (if needed)
- Advanced audit/compliance controls
- Tenant-level backup/export policy controls

## 6. Data Model Additions (Planned)
- `Tenant`
- `TenantSettings`
- `TenantBranding`
- `TenantDomain`
- `Plan`
- `PlanEntitlement`
- `Subscription`
- `Invoice`
- `PaymentEvent`
- `UsageMeter`
- `UsageSnapshot`

## 7. API and UI Additions (Planned)

API domains:
- Tenant provisioning and lifecycle
- Setup wizard orchestration
- Branding/domain management
- Billing/subscription endpoints
- Usage and quota endpoints

UI domains:
- Setup Wizard (first-run)
- Tenant Admin -> Branding
- Tenant Admin -> Subscription and Usage
- Tenant Admin -> Domain mapping

## 8. Key Risks and Decisions
- Supporting both MongoDB and PostgreSQL substantially increases engineering and QA complexity.
- Entitlement checks must be centralized to avoid inconsistent enforcement.
- Custom domains require careful security controls to prevent domain hijacking.
- Migration path from single-tenant data to tenant-scoped model must be planned before production SaaS launch.

## 9. Immediate Planning Deliverables
1. Tenant architecture RFC (scoping rules, auth claims, repository enforcement).
2. Edition matrix (self-hosted vs managed cloud) with exact feature/limit policy.
3. Setup wizard functional spec (common + edition-specific steps).
4. Billing and metering spec (entities, events, enforcement points).
5. Domain mapping technical spec (DNS, TLS, routing, verification).
