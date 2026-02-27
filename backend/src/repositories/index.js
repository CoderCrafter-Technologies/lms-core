// Repository exports - Database Access Layer
const UserRepository = require('./UserRepository');
const CourseRepository = require('./CourseRepository');
const BatchRepository = require('./BatchRepository');
const LiveClassRepository = require('./LiveClassRepository');
const RoleRepository = require('./RoleRepository');
const PermissionRepository = require('./PermissionRepository');
const EnrollmentRepository = require('./EnrollmentRepository');
const AssessmentRepository = require('./AssessmentRepository');
const AssessmentSubmissionRepository = require('./AssessmentSubmissionRepository');
const ResourceRepository = require('./ResourceRepository');
const RefreshSessionRepository = require('./RefreshSessionRepository');
const NotificationRepository = require('./NotificationRepository');
const MonitoringRepository = require('./MonitoringRepository');

// Initialize repositories
const userRepository = new UserRepository();
const courseRepository = new CourseRepository();
const batchRepository = new BatchRepository();
const liveClassRepository = new LiveClassRepository();
const roleRepository = new RoleRepository();
const permissionRepository = new PermissionRepository();
const enrollmentRepository = new EnrollmentRepository();
const assessmentRepository = new AssessmentRepository();
const assessmentSubmissionRepository = new AssessmentSubmissionRepository();
const resourceRepository = new ResourceRepository();
const refreshSessionRepository = new RefreshSessionRepository();
const notificationRepository = new NotificationRepository();
const monitoringRepository = new MonitoringRepository();

module.exports = {
  userRepository,
  courseRepository,
  batchRepository,
  liveClassRepository,
  roleRepository,
  permissionRepository,
  enrollmentRepository,
  assessmentRepository,
  assessmentSubmissionRepository,
  resourceRepository,
  refreshSessionRepository,
  notificationRepository,
  monitoringRepository
};

