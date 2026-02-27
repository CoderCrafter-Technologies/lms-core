# Email Service Technical Documentation
Last updated: 2026-02-16

## Service Scope
- Service file: `backend/src/services/emailService.js`
- Library: `nodemailer`
- Config source: `backend/src/config/index.js` + environment variables.

## Backend Implementation Summary
- Transport behavior:
  - Production: SMTP host/port auth
  - Development: Gmail service auth
- Core email flows implemented:
  - welcome email
  - batch enrollment email
  - password-related and account lifecycle notifications (where invoked)

## Technical Architecture (Brief)
- Email service is application service layer:
  - decoupled from controllers
  - reusable by admin/instructor/student workflow controllers
- Returns success/error metadata for caller-side handling and logs.

## Frontend Integration Summary
- No direct frontend integration (server-side service).
- Frontend depends on backend-triggered account and workflow notification behavior.

## Operational Notes
- Requires SMTP/Gmail credentials in environment.
- For scale, asynchronous dispatch queue is recommended to avoid request-path latency impact.
