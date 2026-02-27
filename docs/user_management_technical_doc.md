# User Management Technical Documentation
Last updated: 2026-02-16

## Backend Implementation Summary
- Routes:
  - `backend/src/routes/users.js`
  - `backend/src/routes/students.js`
  - `backend/src/routes/instructors.js`
  - `backend/src/routes/instructor.js`
- Repositories:
  - `backend/src/repositories/UserRepository.js`
- Models:
  - `backend/src/models/User.js`
  - `backend/src/models/Role.js`

## Technical Architecture (Brief)
- User domain is role-centric:
  - Shared user entity with role linkage (`roleId`).
- Two operational styles for instructor/student management:
  - Role-specific domain routes (`/students`, `/instructors`, `/instructor`)
  - Admin orchestration routes in `admin.js`.
- Security-related user fields:
  - Account lock controls (`loginAttempts`, `lockUntil`)
  - Security settings (`securitySettings.*`)

## Frontend Implementation Summary
- User management views:
  - `frontend/app/dashboard/users/page.tsx`
  - `frontend/app/dashboard/students/*`
  - `frontend/app/dashboard/instructors/*`
- Role-aware behavior in dashboard shell:
  - `frontend/app/dashboard/layout.tsx`
- Authentication context feeding user role/profile:
  - `frontend/components/providers/AuthProvider.tsx`

## Important Notes
- Frontend token usage has been migrated away from legacy localStorage reads.
- Role-aware pages consume auth context with centralized API auth header helpers.
