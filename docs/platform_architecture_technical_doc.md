# Platform Architecture Technical Documentation
Last updated: 2026-02-16

## Backend Architecture Overview
- Entry point: `backend/src/server.js`
- Core middleware stack:
  - `helmet`
  - `cors`
  - `express-rate-limit`
  - `cookie-parser`
  - request logging middleware
- Error handling:
  - global handler in `backend/src/middleware/errorHandler.js`
- Data access architecture:
  - model + repository pattern (`backend/src/models/*`, `backend/src/repositories/*`)
- Realtime:
  - Socket.IO server integrated with HTTP server
- Background jobs:
  - Live class cron orchestration

## Frontend Architecture Overview
- Framework: Next.js app router (`frontend/app/*`)
- Primary domain areas:
  - dashboard modules by role
  - live classroom
  - assessments
  - support
- Client auth/session:
  - provider pattern (`AuthProvider`)
  - centralized API wrapper (`frontend/lib/api.ts`)

## Integration Boundaries
- API boundary:
  - REST for CRUD/domain operations
  - Socket.IO for realtime classroom interactions
- Auth boundary:
  - access token in-memory on client
  - refresh session via HttpOnly cookie
- File/content boundary:
  - resource endpoints for download/preview/stream/public sharing

## Cross-Cutting Concerns
- Security:
  - role/permission checks
  - cookie-based refresh session controls
  - device/session revoke APIs
- Observability:
  - request logging and error logging in place
  - deeper metrics/tracing still a future enhancement area
- Scalability:
  - current socket room state is in-process and single-instance oriented
  - shared state adapter is needed for horizontal scaling.
