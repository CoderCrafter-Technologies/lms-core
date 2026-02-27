# Live Class Cron Service Technical Documentation
Last updated: 2026-02-16

## Service Scope
- Cron bootstrap: `backend/src/cron/liveClassCron.js`
- Service logic: `backend/src/services/liveClassCronService.js`
- Scheduler library: `node-cron`

## Backend Implementation Summary
- Starts on server boot in `backend/src/server.js`.
- Configurable schedule:
  - `LIVE_CLASS_CRON_SCHEDULE`
  - `ENABLE_LIVE_CLASS_CRON`
- Behavior:
  - periodically updates live class statuses
  - protects against overlapping runs with `isRunning` guard
  - executes immediate delayed run after startup
  - exposes manual trigger/status/stat methods.

## Technical Architecture (Brief)
- Scheduled background orchestration layer for class lifecycle consistency.
- Works with persistent live class records and status transitions.
- Decouples temporal status management from request-time endpoints.

## Frontend Integration Summary
- No direct client integration.
- Frontend live class listings and room join checks rely on statuses maintained by this cron.

## Operational Notes
- Ensure timezone and schedule values are aligned with business expectations.
- Add monitoring around job duration/failure rate for production reliability.
