# Feature Status Matrix
Last updated: 2026-02-23

Status legend:
- `WORKING`: Implemented and usable.
- `PARTIAL`: Implemented but missing depth/coverage.
- `PENDING`: Not implemented yet.
- `RISK`: Implemented but has architectural/operational risk.

## 1. LMS Product Features
| Area | Feature | Status | Primary Paths | Next Action |
|---|---|---|---|---|
| Auth | Login/refresh/logout/session revoke | WORKING | `backend/src/routes/auth.js`, `frontend/app/auth/login/page.tsx` | Add automated regression tests for multi-session revoke |
| Auth | OTP registration | WORKING | `backend/src/routes/auth.js`, `frontend/app/auth/register/page.tsx` | Add resend + cooldown UI |
| Auth | OTP password setup (admin triggered) | WORKING | `backend/src/routes/admin.js`, `backend/src/routes/auth.js`, `frontend/app/auth/password-otp/page.tsx` | Add admin OTP audit/history view |
| Auth | Forgot password (reset link + OTP) | WORKING | `backend/src/routes/auth.js`, `backend/src/services/emailService.js`, `frontend/app/auth/forgot-password/page.tsx`, `frontend/app/auth/reset-password/page.tsx` | Add OTP resend/rate-limit UX on reset screen |
| Setup | First-run setup wizard | WORKING | `backend/src/routes/setup.js`, `frontend/app/setup/page.tsx` | Add setup completion analytics event |
| Setup | Branding/logo/favicon | WORKING | `backend/src/services/setupService.js`, `frontend/components/providers/SetupProvider.tsx` | Add asset dimension validation messaging |
| Email | LMS SMTP config + test | WORKING | `backend/src/services/smtpService.js`, `frontend/app/dashboard/settings/page.tsx` | Add provider presets (Gmail/SES/SendGrid SMTP) |
| Email | Class reminder emails (5 min) | WORKING | `backend/src/services/liveClassCronService.js` | Add retry queue/failed delivery logs |
| Email | Admin event emails | WORKING | `backend/src/controllers/*`, `backend/src/services/emailService.js` | Add template customization support |
| Courses | Course CRUD/publish/review | WORKING | `backend/src/routes/courses.js`, `frontend/app/dashboard/courses/page.tsx` | Add course clone UI improvements |
| Batches | Batch CRUD + class scheduling | WORKING | `backend/src/routes/batches.js`, `backend/src/controllers/batchController.js` | Add schedule conflict detection |
| Live Classes | Class lifecycle + room entry | WORKING | `backend/src/routes/liveClasses.js`, `frontend/components/LiveClassRoom.tsx` | Add host migration/failover handling |
| Attendance | Attendance analytics + rebaseline | WORKING | `backend/src/services/liveClassAnalyticsService.js` | Add downloadable attendance audit report |
| Assessments | Create/take/results/gradebook | WORKING | `backend/src/routes/assessments.js`, `frontend/app/dashboard/assessments/*` | Add question bank versioning |
| Support | Tickets/threads/admin queue | WORKING | `backend/src/routes/support.js`, `frontend/app/dashboard/support/page.tsx` | Add SLA timers and escalation actions |
| Notifications | In-app + digest + custom send | WORKING | `backend/src/routes/notifications.js`, `frontend/components/NotificationCenter.tsx` | Add role-based notification templates |
| Monitoring | Logs/events/errors + policy/export | WORKING | `backend/src/routes/monitoring.js`, `frontend/app/dashboard/monitoring/page.tsx` | Add webhook alert channel |
| User Mgmt | Student/instructor/user admin actions | WORKING | `backend/src/routes/students.js`, `backend/src/routes/instructor.js`, `backend/src/routes/instructors.js`, `backend/src/routes/users.js` | Add integration tests for self-vs-admin ownership authorization |
| Certificates | Certificate lifecycle | PARTIAL | `backend/src/routes/enrollments.js`, `frontend/app/dashboard/certifications/page.tsx` | Implement verify/revoke/public verification |

## 2. SaaS and Control Plane Features
| Area | Feature | Status | Primary Paths | Next Action |
|---|---|---|---|---|
| Control Plane | Separate super-admin app | WORKING | `super-admin/*` | Add auth/RBAC for control-plane operators |
| Control Plane | Heartbeat ingestion + instance registry | WORKING | `super-admin/app/api/v1/instances/heartbeat/route.ts` | Add heartbeat anomaly alerts |
| Control Plane | Instances/licenses/usage dashboards | WORKING | `super-admin/app/dashboard/*`, `super-admin/lib/control-plane-store.ts` | Add filters + CSV export |
| Control Plane | Plans management | WORKING | `super-admin/app/dashboard/plans/page.tsx` | Add plan versioning and audit trail |
| Control Plane | Notices broadcast | WORKING | `super-admin/app/dashboard/notifications/page.tsx` | Add schedule/publish window support |
| Control Plane | Notice email channel (`sendEmail`) | WORKING | `super-admin/app/api/admin/notices/route.ts`, `backend/src/services/telemetryLicensingService.js` | Add per-notice delivery metrics |
| Control Plane | Super-admin SMTP settings + test | WORKING | `super-admin/app/api/admin/settings/smtp/route.ts`, `super-admin/components/admin/SmtpSettingsForm.tsx` | Add provider presets + secret masking UX |
| Licensing | Instance/license identity sync | WORKING | `backend/src/services/telemetryLicensingService.js` | Add key rotation workflow |
| SaaS Onboarding | Marketing->LMS signed setup handoff | WORKING | `marketing-site/lib/handoff.ts`, `backend/src/routes/setup.js`, `frontend/app/setup/page.tsx` | Add one-time token replay prevention store |
| SaaS Onboarding | Managed checkout payment+license pre-stage | WORKING (v1/mock) | `marketing-site/lib/lifecycle.ts`, `marketing-site/lib/db.ts` | Integrate real payment webhook reconciliation |
| Admin UX | Plan summary + upgrade CTA in LMS settings | WORKING | `frontend/app/dashboard/settings/page.tsx`, `backend/src/routes/admin.js` | Add limits/quota panel and renewal metadata |
| Policy | Entitlement middleware and policy cache | WORKING | `backend/src/middleware/entitlementMiddleware.js`, `backend/src/services/telemetryLicensingService.js`, `backend/src/routes/admin.js`, `backend/src/routes/monitoring.js` | Expand entitlement checks to remaining premium endpoints over time |
| Tenancy | Tenant isolation model | WORKING | `backend/src/middleware/tenantContext.js`, `backend/src/models/plugins/tenantScoped.js`, `backend/src/services/tenantIsolationService.js`, `backend/src/models/User.js`, `backend/src/models/Course.js`, `backend/src/models/Batch.js` | Add dynamic tenant domain registry if custom domains move beyond env mapping |
| Tenancy | Custom domains (setup + settings + DNS verify) | WORKING (MVP) | `backend/src/models/CustomDomain.js`, `backend/src/services/customDomainService.js`, `backend/src/routes/setup.js`, `backend/src/routes/admin.js`, `frontend/app/setup/page.tsx`, `frontend/app/dashboard/settings/page.tsx` | Add managed TLS provisioning/renewal automation and control-plane sync |
| Billing | Paid subscription lifecycle/webhooks | WORKING (MVP) | `backend/src/models/Subscription.js`, `backend/src/models/Invoice.js`, `backend/src/services/billingWebhookService.js`, `backend/src/routes/billing.js` | Add provider-specific webhook adapters and retry/reconciliation jobs |

## 3. Known Risks
| Risk | Status | Impact | Mitigation |
|---|---|---|---|
| PostgreSQL runtime enablement before repository migration | RISK | Low | Keep `ENABLE_POSTGRES_RUNTIME=false` by default (enforced in env + runtime checks); only enable after native repository migration |

## 4. Release Gate Checklist
- [x] Runtime DB mode parity completed
- [x] Tenant isolation baseline introduced
- [x] Billing lifecycle MVP implemented (currently provider-agnostic webhook baseline)
- [x] Entitlement enforcement coverage expanded
- [x] Custom domain workflow in setup/settings implemented (verification in settings)
- [x] Resource-level ownership coverage completed across protected routes
- [ ] Control-plane operator auth + audit trail enabled
- [ ] OTP/admin email flows covered by integration tests
