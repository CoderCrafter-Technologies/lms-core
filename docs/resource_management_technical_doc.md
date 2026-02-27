# Resource Management Technical Documentation
Last updated: 2026-02-16

## Backend Implementation Summary
- Routes:
  - `backend/src/routes/resources.js`
  - `backend/src/routes/publickResources.js`
- Controller:
  - `backend/src/controllers/resourceController.js`
- Model:
  - `backend/src/models/Resource.js`

### Resource API Capabilities
- Authenticated resource management:
  - list, stats, by course/batch
  - create/update/delete/archive
  - get/download/preview/stream
- Public resource access:
  - list
  - get/preview/download

## Technical Architecture (Brief)
- Resource model supports scoped ownership/access (course, batch, class context).
- Preview and streaming endpoints support large file handling.
- Public and private access paths are separated at route level.

## Frontend Implementation Summary
- Resource interactions are integrated into:
  - course and batch pages
  - file preview flows
  - upload modals
- Representative components:
  - `frontend/components/modals/ResourceUploadModal.tsx`
  - `frontend/components/modals/FilePreviewModal.tsx`

## Notes
- Resource delivery paths include both inline preview and download semantics.
- Public resource route naming includes legacy typo (`publickResources.js`) in current code.
