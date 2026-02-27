# Course, Batch, and Enrollment Technical Documentation
Last updated: 2026-02-16

## Backend Implementation Summary
- Routes:
  - `backend/src/routes/courses.js`
  - `backend/src/routes/batches.js`
  - `backend/src/routes/enrollments.js`
- Controllers:
  - `backend/src/controllers/courseController.js`
  - `backend/src/controllers/batchController.js`
  - `backend/src/controllers/entrollmentsController.js`
- Models:
  - `backend/src/models/Course.js`
  - `backend/src/models/Batch.js`
  - `backend/src/models/Enrollment.js`

## Technical Architecture (Brief)
- Course is the parent instructional unit.
- Batch is delivery/schedule grouping under course.
- Enrollment connects user (student) to course/batch and tracks:
  - progress
  - attendance
  - grades
  - payment/certificate state
- APIs support full lifecycle:
  - CRUD for courses and batches
  - enrollment create/update/delete
  - progress/attendance/grade operations

## Frontend Implementation Summary
- Core pages:
  - `frontend/app/dashboard/courses/*`
  - `frontend/app/dashboard/admin/batches/*`
  - `frontend/app/dashboard/courses/track/[enrollmentId]/page.tsx`
- Modals/components:
  - `frontend/components/modals/BatchCreationModal.tsx`
  - `frontend/components/modals/ClassCreationModal.tsx`
  - `frontend/components/modals/ClassEditingModal.tsx`

## Operational Notes
- Course/batch features are central to live class and assessment linking.
- Admin and instructor views expose different subsets of the same data graph.
