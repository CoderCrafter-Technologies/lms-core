# Assessment Technical Documentation
Last updated: 2026-02-16

## Backend Implementation Summary
- Route: `backend/src/routes/assessments.js`
- Controllers:
  - `backend/src/controllers/assessmentController.js`
  - `backend/src/controllers/assessmentSubmissionController.js`
- Models:
  - `backend/src/models/Assessment.js`
  - `backend/src/models/AssessmentSubmission.js`
- Services:
  - `backend/src/services/codeExecutionService.js`

### Assessment API Capabilities
- CRUD + publish + duplicate + export + stats
- Student lifecycle:
  - start attempt
  - save progress
  - run coding question
  - submit
  - results
- Evaluation and grading:
  - auto/manual grading hooks
  - violation logging
  - instructor/admin review endpoints

## Technical Architecture (Brief)
- Assessment model supports mixed sections and coding workflows.
- Submission model stores in-progress and final states.
- Coding execution delegates to external runtime service (Piston API).
- Security settings exist at assessment-level (fullscreen/copy controls etc.).

## Frontend Implementation Summary
- Authoring and management:
  - `frontend/app/dashboard/assessments/*`
- Attempt player:
  - `frontend/app/assessment-player/[assessmentId]/page.tsx`
  - `frontend/app/dashboard/assessments/[assessmentId]/take/page.tsx`
- Result/review:
  - `frontend/app/dashboard/assessments/[assessmentId]/results/page.tsx`

## Notes
- Assessment domain is one of the most feature-rich modules in the codebase.
- Runtime sandbox hardening and analytics depth can be expanded further as product matures.
