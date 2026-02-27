# LMS Core Documentation (Self-Hosted + User Guide)
Last updated: 2026-02-23

## 1. Product Overview
This LMS core platform supports:
- Self-hosted deployment for a single organization.
- Full learning operations: courses, batches, live classes, assessments, attendance, support, notifications, and monitoring.

## 2. Core Platform Features (Marketing-Ready)

### 2.1 Learning and Delivery
- Course creation, publishing, and review workflow.
- Batch management with schedule planning and auto class generation.
- Live classes with real-time classroom experience.
- Attendance analytics by class/week/month and historical re-baseline.

### 2.2 Assessment and Evaluation
- Assessment creation and student attempt flows.
- Auto/manual scoring workflows.
- Code execution support for coding questions.
- Result analytics and gradebook-style reporting.

### 2.3 People and Operations
- Admin/Manager/Instructor/Student role model.
- User, instructor, and student lifecycle management.
- Support ticketing with threaded updates.
- Notification center with digest controls.

### 2.4 Platform Administration
- First-run setup wizard.
- Branding and white-label settings.
- SMTP configuration and test tools.
- Monitoring, retention policy, and export tools.
- Optional telemetry sync (control-plane notices) when configured.

## 3. Self-Hosting Guide

### 3.1 Recommended Requirements
Minimum baseline:
- CPU: 2 vCPU
- RAM: 4 GB
- Storage: 40 GB SSD
- OS: Linux server recommended

Production recommendation:
- CPU: 4+ vCPU
- RAM: 8+ GB
- Storage: 100+ GB SSD
- Reverse proxy with TLS termination
- Managed database backups and monitoring

### 3.2 Environment Setup
Core backend variables (example):
- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `FRONTEND_URL`
- `ENABLE_POSTGRES_RUNTIME=false` (keep disabled unless migration is complete)

Database setup (recommended via setup wizard):
- MongoDB or PostgreSQL details are saved during setup.
- If you prefer env-only configuration:
  - `MONGODB_URI` and `DB_NAME` for MongoDB
  - `POSTGRES_*`/URI if PostgreSQL runtime is enabled

### 3.3 Deployment Steps (Self-hosted)
1. Clone repository and install dependencies.
2. Configure backend `.env` and frontend environment values.
3. Start services (`backend`, `frontend`).
4. Run setup wizard at `/setup`.
5. Configure branding, database mode, SMTP, and admin credentials.
6. Configure reverse proxy and HTTPS.
7. Configure SMTP and verify test emails.

### 3.4 SMTP Setup
Set SMTP in setup wizard or settings:
- Host, port, auth user/pass, sender identity.
- Use built-in test action before enabling production notifications.

## 5. User Guide by Role

### 5.1 Admin User Guide
Primary capabilities:
- Complete setup, branding, and platform defaults.
- Manage courses, batches, classes, users, and instructors.
- Configure SMTP, database mode, plan visibility, and custom domains.
- Monitor system health, logs, retention/export, and notifications.

Typical workflow:
1. Complete setup wizard.
2. Configure SMTP and verify mail delivery.
3. Create instructors/students/managers.
4. Publish courses and schedule batches/classes.
5. Review attendance, assessments, and support queue.

### 5.2 Instructor User Guide
Primary capabilities:
- Manage assigned batches/courses.
- Run live classes and classroom activities.
- Create assessments and review submissions.
- Track attendance and learner progress.

Typical workflow:
1. Review assigned batches.
2. Schedule or start live classes.
3. Publish assessments.
4. Grade and provide feedback.

### 5.3 Student User Guide
Primary capabilities:
- Access enrolled courses and live classes.
- Take assessments and view results.
- Track attendance and course progress.
- Raise support tickets.

Typical workflow:
1. Login and open dashboard.
2. Join upcoming class from course tracking screens.
3. Take assigned assessments.
4. Check attendance/progress and notifications.

### 5.4 Manager User Guide
Primary capabilities:
- Operational oversight based on assigned permissions.
- View dashboards and selected management modules.
- Coordinate with admins/instructors on delivery and support.

## 6. Public Documentation Blocks You Can Reuse on Website

### 6.1 Feature Summary Block
"All-in-one LMS with course management, batch scheduling, live classes, assessments, attendance analytics, support ticketing, notifications, and monitoring in one platform."

### 6.2 Self-Hosting Block
"Deploy on your own infrastructure with setup wizard, branding controls, and SMTP integration."

## 7. Known Limitations (Public-Safe)
- Horizontal scaling for realtime classrooms requires a shared state adapter.
- Advanced monitoring and tracing integrations are planned.

## 8. Recommended Documentation Site Structure
For your marketing/documentation website, use these top-level sections:
1. Product Features
2. Roles and Permissions
3. Self-Hosting Guide
4. SMTP and Notifications
5. Assessments and Attendance
6. Monitoring and Operations
7. FAQ and Troubleshooting
