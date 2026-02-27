# Super Admin App Setup

Last updated: 2026-02-22

## Project Location

- `super-admin/` (separate Next.js project in repository root)

## Local Run

1. `cd super-admin`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:3001`

Before run, create `super-admin/.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lms_futureproof
CONTROL_PLANE_SIGNING_SECRET=change-super-admin-signing-secret
```

## Docker Run

Using root compose:

1. `docker compose up --build -d`
2. Super Admin UI/API: `http://localhost:3001`

## Database

Super Admin now uses PostgreSQL (not JSON file). It auto-creates these tables:
- `cp_instances`
- `cp_plans`
- `cp_licenses`
- `cp_usage_snapshots`
- `cp_notices`

## Included Control Plane APIs

- `POST /api/v1/instances/register`
- `POST /api/v1/instances/heartbeat`
- `GET /api/v1/instances/policy`
- `GET /api/v1/instances/notices`

## LMS Integration Environment

Set in LMS backend env:

```env
ENABLE_CONTROL_PLANE_SYNC=true
CONTROL_PLANE_URL=http://super_admin:3001
CONTROL_PLANE_SIGNING_SECRET=change-super-admin-signing-secret
```

Set same secret in Super Admin env:

```env
CONTROL_PLANE_SIGNING_SECRET=change-super-admin-signing-secret
```
