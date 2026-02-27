# SaaS and Feature Audit
Last updated: 2026-02-23

## 1. Audit Scope
This audit is based on current repository code and runtime behavior as of 2026-02-23.

Reviewed areas:
- Backend: `backend/src/routes`, `backend/src/services`, `backend/src/models`, `backend/src/middleware`
- Frontend: `frontend/app`, `frontend/components`, `frontend/lib/api.ts`
- Platform apps: `super-admin/*`, `marketing-site/*`

Validation run:
- Frontend typecheck: `cd frontend && npx tsc --noEmit` -> PASS

## 2. Executive Summary
Core LMS product is production-capable for single-instance deployment and strong for self-hosted rollouts.
SaaS foundation has advanced from baseline to MVP in tenancy, entitlement coverage, billing lifecycle primitives, and custom domain management.

Readiness summary:
- LMS product readiness (single-instance): **High**
- Self-hosted edition readiness: **High**
- Managed SaaS readiness: **Medium**

Current managed blockers (priority):
1. Provider-specific billing adapters, retries, and reconciliation jobs are not complete.
2. Custom-domain lifecycle is implemented but managed TLS automation/renewal is still pending.
3. Entitlement enforcement coverage is expanded but not yet universal across all premium write paths.
4. Control-plane operator auth/RBAC/audit trail is still pending.

## 3. Complete Feature Inventory and Status
Status legend:
- `WORKING`: Implemented and actively wired in UI/API.
- `WORKING (MVP)`: Implemented and usable with known depth gaps.
- `PARTIAL`: Implemented but still limited.
- `BROKEN/RISK`: Behavior mismatch, technical defect, or operational risk.
- `PENDING`: Not implemented.

### 3.1 Core LMS Features
| Feature | Status | Evidence |
|---|---|---|
| Authentication (login, refresh, logout, profile) | WORKING | `backend/src/routes/auth.js`, `frontend/app/auth/login/page.tsx` |
| OTP registration flow | WORKING | `backend/src/routes/auth.js`, `frontend/app/auth/register/page.tsx` |
| OTP password setup flow (admin-triggered) | WORKING | `backend/src/routes/admin.js`, `backend/src/routes/auth.js`, `frontend/app/auth/password-otp/page.tsx` |
| Forgot-password recovery (reset link + OTP) | WORKING | `backend/src/routes/auth.js`, `backend/src/services/emailService.js`, `frontend/app/auth/forgot-password/page.tsx`, `frontend/app/auth/reset-password/page.tsx` |
| Session security (rotation, device revoke, revoke-all) | WORKING | `backend/src/routes/auth.js`, `backend/src/models/RefreshSession.js` |
| Role-based authorization (Admin/Manager/Instructor/Student) | WORKING | `backend/src/middleware/roleMiddleware.js`, `backend/src/middleware/auth.js` |
| Setup wizard (first-run) | WORKING | `backend/src/routes/setup.js`, `backend/src/services/setupService.js`, `frontend/app/setup/page.tsx` |
| Branding (logo/favicon/app name/colors) | WORKING | `backend/src/routes/setup.js`, `frontend/app/setup/page.tsx`, `frontend/components/providers/SetupProvider.tsx` |
| Course CRUD/publish/review flow | WORKING | `backend/src/routes/courses.js`, `frontend/app/dashboard/courses/page.tsx` |
| Batch CRUD and scheduling | WORKING | `backend/src/routes/batches.js`, `frontend/app/dashboard/admin/batches/page.tsx` |
| Live class lifecycle and room access | WORKING | `backend/src/routes/liveClasses.js`, `frontend/app/classroom/[roomId]/page.tsx` |
| Attendance analytics/rebaseline | WORKING | `backend/src/services/liveClassAnalyticsService.js`, `backend/src/services/liveClassHistoricalAttendanceService.js`, `frontend/app/dashboard/attendance/page.tsx` |
| Assessments + code execution + grading | WORKING | `backend/src/routes/assessments.js`, `backend/src/services/codeExecutionService.js`, `frontend/app/dashboard/assessments/*` |
| Resource/content delivery | WORKING | `backend/src/routes/resources.js`, `backend/src/routes/publickResources.js`, `frontend/app/dashboard/courses/*` |
| Support ticketing + leave flow | WORKING | `backend/src/routes/support.js`, `frontend/app/dashboard/support/page.tsx`, `frontend/app/dashboard/admin/support/page.tsx` |
| Notifications + digest + custom sends | WORKING | `backend/src/routes/notifications.js`, `backend/src/services/notificationDigestService.js`, `frontend/app/dashboard/notifications/page.tsx` |
| Monitoring + policy + export | WORKING | `backend/src/routes/monitoring.js`, `frontend/app/dashboard/monitoring/page.tsx` |
| User/instructor/student administration | WORKING | `backend/src/routes/users.js`, `backend/src/routes/instructor.js`, `backend/src/routes/instructors.js`, `backend/src/routes/students.js` |
| Certificates (issue/revoke/public verify lifecycle) | PARTIAL | `backend/src/routes/enrollments.js`, `frontend/app/dashboard/certifications/page.tsx` |

### 3.2 SaaS Platform Features
| SaaS Capability | Status | Notes |
|---|---|---|
| Tenant model (`tenantId`, plugin, backfill) | WORKING (MVP) | Request context + tenant-scoped plugin + startup backfill implemented (`backend/src/middleware/tenantContext.js`, `backend/src/models/plugins/tenantScoped.js`, `backend/src/services/tenantIsolationService.js`) |
| Tenant-aware unique constraints | WORKING (MVP) | Tenant-scoped unique indexes implemented and startup migration support added (`backend/src/services/tenantIsolationService.js`, scoped model indexes) |
| Tenant routing (host -> tenant) | WORKING (MVP) | Resolution supports verified custom domains + env host map + base-domain fallback (`backend/src/middleware/tenantContext.js`, `backend/src/services/customDomainService.js`) |
| Custom domains in setup and settings | WORKING (MVP) | Setup and settings both provide DNS records; DNS verification intentionally exposed only in settings (`backend/src/routes/setup.js`, `backend/src/routes/admin.js`, `frontend/app/setup/page.tsx`, `frontend/app/dashboard/settings/page.tsx`) |
| License identity and metadata sync | WORKING | Heartbeat identity + policy cache + status metadata implemented (`backend/src/services/telemetryLicensingService.js`) |
| Plans/subscriptions/invoices/payment webhooks | WORKING (MVP) | Subscription/Invoice models + provider webhook endpoint + admin visibility implemented (`backend/src/models/Subscription.js`, `backend/src/models/Invoice.js`, `backend/src/routes/billing.js`) |
| Entitlement policy middleware | WORKING (MVP) | Middleware + policy state + route enforcement on key premium endpoints implemented (`backend/src/middleware/entitlementMiddleware.js`, `backend/src/routes/admin.js`, `backend/src/routes/monitoring.js`) |
| Super-admin telemetry dashboards | WORKING | Heartbeat ingestion + instances/licenses/plans/notices views are active in `super-admin` |
| Cross-instance notices with optional email | WORKING (MVP) | Control-plane notices synced into LMS admins; email channel available (`backend/src/services/telemetryLicensingService.js`) |
| Managed vs self-hosted edition handling | WORKING (MVP) | Edition/license/plan metadata is used in lifecycle and policy context; deeper operator controls still pending |

## 4. Pending Work (Actionable)

### 4.1 Product and UX
1. Certificate verification/revocation/public verification lifecycle.
2. Manager dashboard functional depth parity with admin/instructor paths.
3. Remove or gate debug/test-only screens from production nav (`/debug-socket`, `/dashboard/test-fixes`).
4. Admin OTP lifecycle audit/history screens.

### 4.2 SaaS and Platform
1. Billing provider adapters (Stripe/Razorpay/etc), retry queue, reconciliation jobs, and idempotent event store.
2. Managed custom-domain TLS automation and cert renewal tracking.
3. Universal entitlement enforcement across remaining premium write/read paths.
4. Control-plane operator auth, RBAC, and audit trail.
5. Dynamic cross-instance domain registry synchronization (control-plane <-> LMS instances).

## 5. Broken / Risky Items
1. **PostgreSQL enablement sequencing risk (low):** runtime still intentionally guarded and should remain disabled until native repository migration is complete.
   - Evidence: `backend/src/config/database.js`, `backend/src/services/databaseSettingsService.js`.
2. **Route naming debt:** `publickResources.js` typo is still carried for compatibility and should be normalized carefully.
3. **Custom-domain maturity risk (managed):** ownership verification exists, but managed certificate lifecycle automation is not complete.
4. **Billing maturity risk:** webhook ingestion and data models are present, but provider-specific robustness (retries/reconciliation) remains pending.

## 6. Final Assessment
- Core LMS is production-capable for self-hosted deployments.
- SaaS platform has moved to a stronger MVP state with implemented tenancy isolation, host routing, custom domains, billing data models/webhooks, and entitlement enforcement scaffolding.
- Next strategic milestones are managed-grade domain/TLS automation, provider-grade billing reliability, and control-plane operator security/audit.
