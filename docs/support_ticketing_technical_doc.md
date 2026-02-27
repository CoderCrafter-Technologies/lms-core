# Support and Ticketing Technical Documentation
Last updated: 2026-02-16 (thread messaging + attachment preview rollout)

## Backend Implementation Summary
- Route: `backend/src/routes/support.js`
- Controller: `backend/src/controllers/supportController.js`
- Model: `backend/src/models/Ticket.js`

### Ticketing API Capabilities
- User-facing:
  - create ticket
  - list own tickets
  - view ticket details
  - add thread replies/messages
- Admin/manager-facing:
  - list all tickets
  - update ticket status
  - approve/reject leave requests
  - dashboard stats
- Thread endpoints:
  - `GET /api/support/tickets/:id/messages`
  - `POST /api/support/tickets/:id/messages`
  - Backward-compatible endpoint retained: `POST /api/support/tickets/:id/reply`

## Technical Architecture (Brief)
- Single ticket domain handles support + leave workflow semantics.
- Thread messages are stored in `Ticket.replies[]` with per-message author and timestamp.
- Attachment handling supported via upload middleware in support routes (message-level attachments).
- Access control for thread reads/writes:
  - ticket owner
  - assigned user
  - admin/manager
- Uploaded ticket files are exposed via backend static mount:
  - `GET /uploads/tickets/*`
- Role checks differentiate user and administrative actions.

## Frontend Implementation Summary
- User support page:
  - `frontend/app/dashboard/support/page.tsx`
- Admin/manager support operations:
  - `frontend/app/dashboard/admin/support/page.tsx`
- Unified thread UX across roles:
  - icon-based attachment picker (paperclip)
  - square attachment tiles (selected + historical messages)
  - image/file preview dialog with close/open controls
  - auto-clear selected attachments after successful send

## Notes
- Leave-request approval is implemented as ticket-state workflow endpoints.
