# Authentication Technical Documentation
Last updated: 2026-02-16 (in-memory access token + cookie refresh finalized)

## Backend Implementation Summary
- Core route file: `backend/src/routes/auth.js`
- Core middleware: `backend/src/middleware/auth.js`
- Session persistence model: `backend/src/models/RefreshSession.js`
- Session repository: `backend/src/repositories/RefreshSessionRepository.js`
- Cookie support: `backend/src/server.js` (`cookie-parser`)

### Auth APIs
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/change-password`

### Session and Security APIs
- `GET /api/auth/sessions`
- `POST /api/auth/sessions/:sessionId/revoke`
- `POST /api/auth/sessions/revoke-all`
- `GET /api/auth/security-settings`
- `PUT /api/auth/security-settings`

## Technical Architecture (Brief)
- Access token:
  - JWT access token issued on login/register/refresh.
  - Verified by `authenticateToken`.
- Refresh token:
  - Stored as `HttpOnly` cookie (`refreshToken`).
  - Contains session id (`sid`) + version (`ver`).
  - Rotated on each refresh.
- Revocation model:
  - Refresh sessions are persisted in MongoDB.
  - Version bump invalidates old refresh tokens.
  - Per-session and global revoke supported.
- Security preferences:
  - Stored on `User.securitySettings`.
  - Includes concurrency policy and sign-in behavior flags.

## Frontend Implementation Summary
- Auth provider: `frontend/components/providers/AuthProvider.tsx`
- API client: `frontend/lib/api.ts`
- Axios client for secondary flows: `frontend/lib/services/apiClient.ts`

### Current Frontend Auth Behavior
- Access token is in-memory (set in API service instance).
- Refresh handled through cookie-based `/auth/refresh` calls with credentials included.
- On app startup, profile fetch (`/auth/me`) drives session restoration via refresh flow if needed.
- Logout calls backend logout and clears client token state.
- Legacy direct `localStorage('authToken')` usage has been removed from active frontend pages/components.
- Auth header construction now uses centralized API service helpers (`api.getToken()`, `api.getAuthorizationHeader()`).

## Operational Notes
- Cookie flags are environment-sensitive in backend auth route helpers.
- For cross-site deployments, verify:
  - CORS `credentials: true`
  - Correct cookie `SameSite` and `Secure` configuration
  - HTTPS on frontend/backend.
