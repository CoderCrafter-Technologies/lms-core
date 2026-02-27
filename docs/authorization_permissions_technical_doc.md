# Authorization and Permissions Technical Documentation
Last updated: 2026-02-16

## Backend Implementation Summary
- Middleware: `backend/src/middleware/auth.js`
  - `authenticateToken`
  - `requireRole`
  - `requirePermission`
  - `requireOwnership`
- Additional role middleware used in some modules:
  - `backend/src/middleware/roleMiddleware.js`
- Permissions route:
  - `backend/src/routes/permissions.js`

## Technical Architecture (Brief)
- Authentication and authorization are separated:
  - Token validation and user loading happen first.
  - Role/permission checks happen per route.
- Pattern in protected routes:
  - Auth middleware at mount-level in `backend/src/server.js`.
  - Fine-grained role/permission middleware in route handlers.
- Role-aware modules:
  - Live classes, assessments, resources, admin/user operations.

## Frontend Implementation Summary
- Route-level protection:
  - `frontend/components/providers/AuthProvider.tsx`
  - Protected path utility: `frontend/lib/auth/jwt.ts`
- Dashboard navigation and visibility:
  - `frontend/app/dashboard/layout.tsx`
  - Navigation entries vary by `user.role.name`.

## Key Considerations
- Authorization logic is distributed across two middleware styles:
  - `requireRole/requirePermission` pattern
  - `roleMiddleware([...])` pattern
- Recommendation for long-term consistency:
  - converge route protection patterns and error contracts.
