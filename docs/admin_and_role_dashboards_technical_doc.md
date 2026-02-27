# Admin and Role Dashboards Technical Documentation
Last updated: 2026-02-16

## Backend Implementation Summary
- Admin route: `backend/src/routes/admin.js`
- Instructor route: `backend/src/routes/instructor.js`
- Instructor management route: `backend/src/routes/instructors.js`
- Student route: `backend/src/routes/students.js`
- Dashboard/user stats are composed from multiple repositories and controllers.

## Technical Architecture (Brief)
- Dashboard experiences are role-segmented:
  - Admin, Manager, Instructor, Student.
- Shared backend services expose role-specific filtered data.
- Admin endpoints include orchestration actions:
  - course/batch overview
  - instructor and student operations
  - bulk enrollment and class auto-generation.

## Frontend Implementation Summary
- Main dashboard shell and role navigation:
  - `frontend/app/dashboard/layout.tsx`
  - `frontend/app/dashboard/page.tsx`
- Role pages:
  - `frontend/app/dashboard/admin/*`
  - `frontend/app/dashboard/manager/*`
  - `frontend/app/dashboard/instructor/*`
  - `frontend/app/dashboard/student/*`
- Settings page:
  - `frontend/app/dashboard/settings/page.tsx`
  - Includes security and sign-in/device management for all roles.

## Notes
- Some manager/admin widgets are functional summaries; some appear as static placeholders and can be progressively wired to APIs.
