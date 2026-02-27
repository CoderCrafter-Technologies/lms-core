# Live Class Technical Documentation
Last updated: 2026-02-16

## Backend Implementation Summary
- REST route: `backend/src/routes/liveClasses.js`
- Controller: `backend/src/controllers/liveClassController.js`
- Model: `backend/src/models/LiveClass.js`
- Realtime service: `backend/src/services/newSocketHandler.js`
- Cron integration: `backend/src/cron/liveClassCron.js`

### Live Class APIs
- List/filter/stats
- Batch-level listing
- Single class by id
- Class by `roomId`
- Create/update/delete
- Start/end/cancel lifecycle actions

## Technical Architecture (Brief)
- Hybrid architecture:
  - REST for scheduling/state transitions
  - Socket.IO for participant signaling and room interaction
- Room state:
  - Held in-memory in socket handler maps (`liveClasses`, room participant maps)
  - Suitable for single-instance deployment
- Class status automation:
  - Cron service updates class statuses on schedule.

## Frontend Implementation Summary
- Classroom entry:
  - `frontend/app/classroom/[roomId]/page.tsx`
- Main live class UI:
  - `frontend/components/NewClassRoom.tsx`
  - `frontend/components/VideoGrid.tsx`
  - `frontend/components/VideoTile.tsx`
  - `frontend/components/LiveClassRoom.tsx`
- Features in UI:
  - Peer connectivity signaling
  - screen share
  - hand raise
  - speaking indicators
  - participant control actions

## Known Constraints
- In-memory room state is not horizontally scalable without shared adapter/state (e.g., Redis).
