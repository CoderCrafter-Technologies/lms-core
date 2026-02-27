# Socket Realtime Service Technical Documentation
Last updated: 2026-02-16

## Service Scope
- Primary realtime handler: `backend/src/services/newSocketHandler.js`
- Additional/legacy handlers exist:
  - `backend/src/services/socketHandler.js`
  - `backend/src/services/enhancedSocketHandler.js`

## Backend Implementation Summary
- Socket server bootstrapped in: `backend/src/server.js`
- Responsibilities:
  - room join/leave orchestration
  - signaling relay for WebRTC peers
  - hand raise/lower events
  - chat messages
  - screen share events
  - speaking level and video toggle events
  - instructor actions

## Technical Architecture (Brief)
- Socket.IO event-driven architecture layered over REST class lifecycle.
- State structure:
  - room map
  - participant/session maps in handler memory
- Broadcast patterns:
  - direct emit for targeted signaling
  - room emit for shared state updates.

## Frontend Integration Summary
- Client entry and room orchestration:
  - `frontend/components/NewClassRoom.tsx`
  - `frontend/components/LiveClassRoom.tsx`
  - `frontend/app/classroom/[roomId]/page.tsx`
- UI update consumers:
  - `frontend/components/VideoGrid.tsx`
  - `frontend/components/VideoTile.tsx`

## Operational Constraints
- Current in-memory room state is single-instance only.
- Horizontal scaling requires shared adapter/state (e.g., Redis + sticky sessions strategy).
