// Models index - Export all models
const User = require('./User');
const Role = require('./Role');
const Permission = require('./Permission');
const RolePermission = require('./RolePermission');
const Course = require('./Course');
const Batch = require('./Batch');
const LiveClass = require('./LiveClass');
const Enrollment = require('./Enrollment');
const PastEnrollment = require('./PastEnrollment');
const Assessment = require('./Assessment');
const AssessmentSubmission = require('./AssessmentSubmission');
const RefreshSession = require('./RefreshSession');
const Notification = require('./Notification');
const MonitoringRecord = require('./MonitoringRecord');
const MonitoringPolicy = require('./MonitoringPolicy');
const Resource = require('./Resource');
const Ticket = require('./Ticket');

module.exports = {
  User,
  Role,
  Permission,
  RolePermission,
  Course,
  Batch,
  LiveClass,
  Enrollment,
  PastEnrollment,
  Assessment,
  AssessmentSubmission,
  RefreshSession,
  Notification,
  MonitoringRecord,
  MonitoringPolicy,
  Resource,
  Ticket,
};

