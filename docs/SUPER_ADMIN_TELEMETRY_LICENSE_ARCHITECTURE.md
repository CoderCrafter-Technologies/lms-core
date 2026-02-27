# Super Admin Telemetry and Licensing Architecture
Last updated: 2026-02-22

## 0. Current LMS Implementation Status (Phase 1)
Implemented in LMS backend:
1. Persistent local telemetry/licensing identity in `system-settings.json`:
   - `instanceId`, `licenseKey`, `edition`, `licenseType`, `planCode`, status, policy cache
2. Heartbeat payload builder with aggregate usage counters.
3. Optional control-plane heartbeat sync (env/config driven).
4. Admin APIs:
   - `GET /api/admin/licensing`
   - `PUT /api/admin/licensing`
   - `GET /api/admin/licensing/heartbeat-preview`
   - `POST /api/admin/licensing/sync`
   - `GET /api/admin/licensing/public-summary`
5. Background heartbeat scheduler started with backend server.
6. Signed heartbeat request headers:
   - `x-signature-alg`, `x-signature-ts`, `x-signature`, `x-signature-kid`
7. Offline policy grace + entitlement evaluation hooks:
   - policy state resolver (`VALID`, `GRACE`, `MISSING_*`, `EXPIRED_*`)
   - reusable entitlement middleware scaffold.

Still pending:
- Separate Super Admin control-plane app and database.
- Central instance registry + plan/subscription/billing lifecycle.
- Policy authority and targeted cross-instance notification delivery.

## 1. Objective
Build a separate Super Admin control-plane application that can:
1. Track all product instances (self-hosted and managed).
2. Classify each instance as free, paid, trial, demo.
3. Enforce licensing/entitlements consistently.
4. Receive usage telemetry safely (no sensitive PII by default).
5. Send update/feature notifications across editions.

## 2. Recommended Topology
Use a control-plane / data-plane split:
- Data plane: each LMS deployment (self-hosted or managed tenant runtime).
- Control plane: your separate Super Admin app + API + database.

Flow:
1. LMS instance registers once -> gets `instanceId` + `licenseKey`.
2. LMS sends periodic heartbeat + usage snapshot to control plane.
3. Control plane returns effective policy (plan/features/limits/update notices).
4. LMS caches policy locally and enforces it.

## 3. Single Identity Model (Important)
Use **one identity model for all editions**:
- `instanceId` (UUID): immutable install identity.
- `licenseKey`: signed token/string linked to instance.

Do not separate schema by edition. Instead use:
- `edition`: `SELF_HOSTED` | `MANAGED`
- `licenseType`: `FREE` | `PAID` | `TRIAL` | `DEMO`

This keeps free and paid on the same rails for upgrades, notifications, and analytics.

## 4. Best Storage Model (Control Plane DB)
Prefer PostgreSQL in the Super Admin app for analytics/reporting integrity.

Core tables:
1. `platform_instances`
   - `instance_id` (pk, uuid)
   - `license_key` (unique)
   - `edition`
   - `license_type`
   - `status` (`ACTIVE`, `SUSPENDED`, `EXPIRED`)
   - `institute_name`
   - `owner_email_hash` (hash, not plain)
   - `app_version`
   - `created_at`, `last_heartbeat_at`
   - `deployment_meta` (jsonb): host hash, runtime type, region
2. `licenses`
   - `license_key` (pk)
   - `instance_id` (fk)
   - `plan_code`
   - `issued_at`, `expires_at`
   - `signature`
   - `constraints` (jsonb)
3. `plans`
   - `plan_code` (pk)
   - `name`
   - `billing_cycle`
   - `price`
   - `features` (jsonb)
   - `limits` (jsonb)
4. `subscriptions`
   - `id` (pk)
   - `instance_id` (fk)
   - `plan_code` (fk)
   - `provider`
   - `provider_customer_id`
   - `provider_subscription_id`
   - `status`
   - `current_period_start`, `current_period_end`
5. `usage_snapshots`
   - `id` (pk)
   - `instance_id` (fk)
   - `period_start`, `period_end`
   - `active_users_7d`, `active_users_30d`
   - `total_users`, `courses`, `batches`, `live_classes`, `assessments`
   - `storage_bytes`, `api_calls`
   - unique key `(instance_id, period_start, period_end)`
6. `instance_notifications`
   - `id` (pk)
   - `target_filter` (jsonb): by edition/plan/version/licenseType
   - `title`, `message`, `severity`
   - `created_at`
7. `instance_notification_deliveries`
   - `id` (pk)
   - `notification_id` (fk)
   - `instance_id` (fk)
   - `status` (`PENDING`, `DELIVERED`, `ACKED`, `FAILED`)
   - `delivered_at`, `acked_at`

## 5. Metadata to Store (Self-hosted + Managed + Demo)
Store only what you need for licensing and business decisions.

Required:
- Identity: `instanceId`, `licenseKey`
- Product classification: `edition`, `licenseType`, `planCode`
- Lifecycle: `status`, `createdAt`, `lastHeartbeatAt`
- Versioning: `appVersion`, `buildChannel` (`stable`, `beta`, `dev`)
- Usage counters: active users + core object counts
- Deployment metadata: runtime type (`docker`, `k8s`, `managed`)

Optional:
- Coarse geography (`country`, `region`) from explicit setting
- Contact channel for update emails

Avoid by default:
- Raw end-user PII
- Full hostname/IP in clear text
- Full event logs from customer data plane

## 6. Self-Hosted vs Managed vs Demo Rules
Use policy, not separate code paths:

1. Self-hosted free:
- `edition=SELF_HOSTED`, `licenseType=FREE`
- limited features/limits in policy
- receives update/security advisories

2. Managed paid:
- `edition=MANAGED`, `licenseType=PAID`
- subscription-backed limits
- premium features enabled

3. Demo/trial:
- `licenseType=DEMO` or `TRIAL`
- strict expiration + capped limits
- auto-convert workflow to paid/free

## 7. API Contracts Between LMS and Super Admin App
Minimal endpoints:
1. `POST /v1/instances/register`
   - input: bootstrap token, institute metadata
   - output: `instanceId`, `licenseKey`, signed policy blob
2. `POST /v1/instances/heartbeat`
   - input: `instanceId`, `licenseKey`, `appVersion`, health/uptime
   - output: policy version + pending notices
3. `POST /v1/instances/usage`
   - input: usage counters for time window
4. `GET /v1/instances/policy`
   - output: feature flags, limits, plan info
5. `GET /v1/instances/notices`
   - output: pending broadcasts targeted to that instance

## 8. Security Model
1. License key must be signed (JWT/JWS or HMAC-signed opaque key).
2. Add request signing from LMS -> control plane:
   - header: `x-instance-id`, `x-signature`, `x-timestamp`
3. Reject stale requests with timestamp window.
4. Rotate keys safely (overlap active keys during rotation).
5. Encrypt at rest for sensitive fields; hash emails for analytics.

## 9. Offline Tolerance (Critical for Self-hosted)
Self-hosted instances may have no internet.

Recommended:
1. Cache last valid policy locally with expiry window.
2. Grace period behavior when control plane unreachable:
   - continue core operation for N days
   - restrict premium-only features after grace if required
3. Queue heartbeat/usage and retry with backoff.

## 10. Rollout Plan
Phase 1:
- Add instance registration + heartbeat only.
- Build Super Admin “Instance Registry” dashboard.

Phase 2:
- Add plans/licenses/policy delivery.
- Start feature flags + limits enforcement in LMS.

Phase 3:
- Add usage snapshots and trend charts.
- Add update notification broadcast system.

Phase 4:
- Add billing/subscription integration for managed paid.
- Add upgrade flows free->paid and trial->paid.

## 11. Immediate Recommendation
Start with these 3 first:
1. `platform_instances` + `licenses` schema in Super Admin DB.
2. `register` + `heartbeat` endpoints.
3. LMS-side persistent `instanceId` + local policy cache.

This gives you future-proof structure without blocking current LMS delivery.
