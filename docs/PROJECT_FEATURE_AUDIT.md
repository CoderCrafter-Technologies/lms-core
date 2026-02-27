# Project Feature Audit (LMS)
Last updated: 2026-02-23

## 1. Audit Scope and Method
This audit reflects the current repository state across backend, frontend, and SaaS/control-plane integration layers.

Reviewed code areas:
- Backend: `backend/src/routes`, `backend/src/controllers`, `backend/src/services`, `backend/src/models`, `backend/src/middleware`, `backend/src/server.js`
- Frontend: `frontend/app`, `frontend/components`, `frontend/lib/api.ts`, `frontend/lib/services/apiClient.ts`
- Platform: `super-admin/*`, `marketing-site/*`
- Docs: `docs/*.md`

Executed checks:
- Frontend type baseline: `cd frontend && npx tsc --noEmit` -> **PASS**

Companion SaaS/platform detail:
- See `docs/SAAS_AUDIT.md` for full SaaS readiness and managed/self-hosted platform status.

## 2. Executive Summary
The LMS product is comprehensive and deployable for self-hosted usage with strong coverage across course delivery, live classes, assessments, support, notifications, and monitoring.

Maturity profile:
- Core LMS operations: **High**
- Admin operations and settings: **High**
- Self-hosted readiness: **High**
- Managed SaaS readiness: **Medium**

Recent architecture progress:
- Tenant-aware data isolation model and unique-index migration workflow.
- Custom-domain capability in setup and settings, with DNS verification in settings.
- Billing lifecycle MVP (`Subscription`, `Invoice`, webhook ingestion routes).
- Expanded entitlement checks on premium monitoring/licensing paths.

## 3. Module-Wise Capability Audit

### 3.1 Authentication and Session Security
Status: **Implemented (strong)**

What exists:
- Register/login/refresh/logout, profile endpoint.
- OTP registration and OTP-based password setup flows.
- Forgot-password with reset link + OTP support.
- Session listing, single-device revoke, revoke-all sessions.
- Security preference endpoints.

Key paths:
- `backend/src/routes/auth.js`
- `backend/src/routes/admin.js`
- `frontend/app/auth/*`

### 3.2 Authorization, Roles, and Permissions
Status: **Implemented**

What exists:
- Role middleware and permission checks.
- Manager-specific permission catalog and assignment flow.
- Ownership enforcement for major self-service surfaces.

Key paths:
- `backend/src/middleware/roleMiddleware.js`
- `backend/src/middleware/auth.js`
- `backend/src/routes/permissions.js`

### 3.3 Dashboards (Admin/Instructor/Manager/Student)
Status: **Implemented (manager still evolving)**

What exists:
- Role-specific dashboard screens and APIs.
- Operational cards and analytics summaries.

Key paths:
- `frontend/app/dashboard/admin/page.tsx`
- `frontend/app/dashboard/instructor/page.tsx`
- `frontend/app/dashboard/manager/page.tsx`
- `frontend/app/dashboard/student/page.tsx`

### 3.4 Course, Batch, and Enrollment Lifecycle
Status: **Implemented**

What exists:
- Course CRUD, publish/review lifecycle, curriculum versioning.
- Batch CRUD, scheduling, auto class generation.
- Enrollment management with progress/attendance/payment state fields.

Key paths:
- `backend/src/routes/courses.js`
- `backend/src/routes/batches.js`
- `backend/src/routes/enrollments.js`
- `backend/src/models/Course.js`
- `backend/src/models/Batch.js`
- `backend/src/models/Enrollment.js`

### 3.5 Live Class and Attendance
Status: **Implemented**

What exists:
- Live class schedule/start/end/cancel and room lookup.
- Attendance analytics, recent summaries, historical re-baseline support.
- Realtime classroom experiences.

Key paths:
- `backend/src/routes/liveClasses.js`
- `backend/src/services/liveClassAnalyticsService.js`
- `frontend/app/classroom/[roomId]/page.tsx`
- `frontend/app/dashboard/attendance/page.tsx`

### 3.6 Assessments and Code Execution
Status: **Implemented (strong v1)**

What exists:
- Assessment CRUD, attempt flow, progress save, submit, results.
- Manual grading features and violation capture.
- Code execution endpoint for coding assessments.

Key paths:
- `backend/src/routes/assessments.js`
- `backend/src/services/codeExecutionService.js`
- `frontend/app/dashboard/assessments/*`

### 3.7 Resources, Support, and Notifications
Status: **Implemented**

What exists:
- Resource upload/preview/download/public links.
- Support ticket lifecycle with admin review actions.
- Notification center, digest controls, send-now, custom notifications.

Key paths:
- `backend/src/routes/resources.js`
- `backend/src/routes/support.js`
- `backend/src/routes/notifications.js`
- `frontend/app/dashboard/support/page.tsx`
- `frontend/app/dashboard/notifications/page.tsx`

### 3.8 Monitoring and Operational Controls
Status: **Implemented**

What exists:
- Monitoring records query/filtering.
- Policy update endpoints, retention/archive runs, export endpoints.
- Health and alert status endpoints.

Key paths:
- `backend/src/routes/monitoring.js`
- `frontend/app/dashboard/monitoring/page.tsx`

### 3.9 Setup, Branding, SMTP, and Admin Settings
Status: **Implemented**

What exists:
- Setup wizard with branding, database mode, SMTP test/config, admin bootstrap.
- Admin settings for database, SMTP, licensing summary, and custom domains.

Key paths:
- `backend/src/routes/setup.js`
- `backend/src/routes/admin.js`
- `backend/src/services/setupService.js`
- `frontend/app/setup/page.tsx`
- `frontend/app/dashboard/settings/page.tsx`

### 3.10 SaaS Onboarding and Control Plane
Status: **Implemented (MVP)**

What exists:
- Marketing-site lifecycle and signed handoff to LMS setup.
- Control-plane heartbeat ingestion and plan/notices dashboards.
- Instance/license metadata sync and notice delivery to LMS admins.

Key paths:
- `marketing-site/lib/lifecycle.ts`
- `marketing-site/lib/handoff.ts`
- `backend/src/services/telemetryLicensingService.js`
- `super-admin/app/api/v1/instances/heartbeat/route.ts`

### 3.11 Tenancy and Custom Domains
Status: **Implemented (MVP)**

What exists:
- Tenant context middleware and tenant-scoped data model plugin.
- Tenant-aware unique indexes and startup migration/backfill path.
- Custom-domain add/list/remove in settings.
- DNS template generation in setup and settings; verification in settings only.
- Host-to-tenant resolution includes verified custom domains.

Key paths:
- `backend/src/middleware/tenantContext.js`
- `backend/src/services/tenantIsolationService.js`
- `backend/src/models/CustomDomain.js`
- `backend/src/services/customDomainService.js`
- `backend/src/routes/setup.js`
- `backend/src/routes/admin.js`
- `frontend/app/setup/page.tsx`
- `frontend/app/dashboard/settings/page.tsx`

### 3.12 Billing and Entitlements
Status: **Implemented (MVP)**

What exists:
- Billing models: `Subscription`, `Invoice`.
- Provider webhook ingestion route and admin billing read endpoints.
- Entitlement middleware and policy-state evaluation; route-level checks on key premium surfaces.

Key paths:
- `backend/src/models/Subscription.js`
- `backend/src/models/Invoice.js`
- `backend/src/routes/billing.js`
- `backend/src/services/billingWebhookService.js`
- `backend/src/middleware/entitlementMiddleware.js`
- `backend/src/routes/monitoring.js`
- `backend/src/routes/admin.js`

### 3.13 Certificates
Status: **Partially Implemented**

What exists:
- Certificate issue hooks and certification page scaffold.

Gap:
- Full verification/revocation/public-lookup lifecycle pending.

Key paths:
- `backend/src/routes/enrollments.js`
- `frontend/app/dashboard/certifications/page.tsx`

## 4. Open Issues and Risk Register

### High
1. Managed-grade billing robustness (provider adapters, retries, reconciliation, idempotency tracking) is still incomplete.
2. Managed custom-domain certificate automation/renewal and centralized domain orchestration are still incomplete.
3. Control-plane operator auth/RBAC/audit trail remains pending.

### Medium
1. Manager dashboard depth is still lower than admin/instructor for some flows.
2. Legacy route naming debt (`publickResources.js`) should be cleaned with backward-compatible migration.
3. Debug/test screens should be gated or excluded from production navigation.

### Low
1. PostgreSQL runtime remains intentionally gated by default until native repository migration is complete.
2. Certificate module lifecycle depth still pending.

## 5. Readiness Assessment
- Single-instance LMS readiness: **High**.
- Self-hosted product readiness: **High**.
- Managed SaaS readiness: **Medium** (MVP foundation present; managed reliability and operator governance tasks remain).

## 6. Recommended Next Focus
1. Complete provider-grade billing reliability layer.
2. Add managed TLS/certificate automation for custom domains.
3. Expand entitlement enforcement to all premium write/read paths.
4. Implement control-plane operator auth + RBAC + audit.
5. Finalize certificate verification/revocation/public verification lifecycle.
