# Code Execution Service Technical Documentation
Last updated: 2026-02-16

## Service Scope
- Service file: `backend/src/services/codeExecutionService.js`
- Utility dependency: `backend/src/utils/httpJson.js`
- External runtime provider:
  - Piston API (`PISTON_EXECUTE_URL`)

## Backend Implementation Summary
- Exposes `executeCode({ language, code, stdin, version })`.
- Sends execution payload to runtime provider and normalizes response fields:
  - `stdout`
  - `stderr`
  - `output`
  - `code`
  - `signal`
- Throws structured error when provider call fails.

## Technical Architecture (Brief)
- Backend acts as mediator:
  - receives code from assessment flows
  - executes remotely via runtime API
  - returns normalized results for UI and grading logic.
- Assessment integration points:
  - `backend/src/routes/assessments.js`
  - `backend/src/controllers/assessmentSubmissionController.js`

## Frontend Integration Summary
- Coding run and submission UX is integrated in assessment attempt pages:
  - `frontend/app/dashboard/assessments/[assessmentId]/take/page.tsx`
  - `frontend/app/assessment-player/[assessmentId]/page.tsx`

## Operational Notes
- Runtime security and limits are partly delegated to external provider.
- For enterprise use, add stronger execution governance and observability around runtime calls.
