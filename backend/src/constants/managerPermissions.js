const MANAGER_PERMISSION_GROUPS = [
  {
    key: 'USER_MANAGEMENT',
    title: 'User Management',
    permissions: [
      { key: 'USER_MANAGEMENT_READ', label: 'View Users' },
      { key: 'USER_MANAGEMENT_CREATE', label: 'Create Users' },
      { key: 'USER_MANAGEMENT_UPDATE', label: 'Update Users' },
      { key: 'USER_MANAGEMENT_DELETE', label: 'Delete Users' }
    ]
  },
  {
    key: 'COURSE_MANAGEMENT',
    title: 'Course Management',
    permissions: [
      { key: 'COURSE_MANAGEMENT_READ', label: 'View Courses' },
      { key: 'COURSE_MANAGEMENT_CREATE', label: 'Create Courses' },
      { key: 'COURSE_MANAGEMENT_UPDATE', label: 'Update Courses' },
      { key: 'COURSE_MANAGEMENT_DELETE', label: 'Delete Courses' }
    ]
  },
  {
    key: 'BATCH_MANAGEMENT',
    title: 'Batch Management',
    permissions: [
      { key: 'BATCH_MANAGEMENT_READ', label: 'View Batches' },
      { key: 'BATCH_MANAGEMENT_CREATE', label: 'Create Batches' },
      { key: 'BATCH_MANAGEMENT_UPDATE', label: 'Update Batches' },
      { key: 'BATCH_MANAGEMENT_DELETE', label: 'Delete Batches' }
    ]
  },
  {
    key: 'LIVE_CLASS_MANAGEMENT',
    title: 'Live Class Management',
    permissions: [
      { key: 'LIVE_CLASS_MANAGEMENT_READ', label: 'View Live Classes' },
      { key: 'LIVE_CLASS_MANAGEMENT_CREATE', label: 'Create Live Classes' },
      { key: 'LIVE_CLASS_MANAGEMENT_UPDATE', label: 'Update Live Classes' },
      { key: 'LIVE_CLASS_MANAGEMENT_DELETE', label: 'Delete Live Classes' }
    ]
  },
  {
    key: 'REPORTING',
    title: 'Reporting',
    permissions: [{ key: 'REPORTING_READ', label: 'View Reports/Analytics' }]
  },
  {
    key: 'SUPPORT_MANAGEMENT',
    title: 'Support Management',
    permissions: [
      { key: 'SUPPORT_MANAGEMENT_READ', label: 'View Support Tickets' },
      { key: 'SUPPORT_MANAGEMENT_UPDATE', label: 'Update/Respond Support Tickets' }
    ]
  },
  {
    key: 'NOTIFICATION_MANAGEMENT',
    title: 'Notification Management',
    permissions: [
      { key: 'NOTIFICATION_MANAGEMENT_SEND', label: 'Send Custom Notifications' }
    ]
  },
  {
    key: 'MONITORING',
    title: 'Monitoring',
    permissions: [
      { key: 'MONITORING_READ', label: 'View Monitoring Dashboard' }
    ]
  }
];

const LEGACY_MANAGER_DEFAULT_PERMISSIONS = [
  'USER_MANAGEMENT_READ',
  'USER_MANAGEMENT_UPDATE',
  'COURSE_MANAGEMENT_CREATE',
  'COURSE_MANAGEMENT_READ',
  'COURSE_MANAGEMENT_UPDATE',
  'BATCH_MANAGEMENT_CREATE',
  'BATCH_MANAGEMENT_READ',
  'BATCH_MANAGEMENT_UPDATE',
  'LIVE_CLASS_MANAGEMENT_CREATE',
  'LIVE_CLASS_MANAGEMENT_READ',
  'LIVE_CLASS_MANAGEMENT_UPDATE',
  'REPORTING_READ',
  'SUPPORT_MANAGEMENT_READ',
  'SUPPORT_MANAGEMENT_UPDATE',
  'NOTIFICATION_MANAGEMENT_SEND'
];

const ALL_MANAGER_PERMISSIONS = MANAGER_PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
);

module.exports = {
  MANAGER_PERMISSION_GROUPS,
  ALL_MANAGER_PERMISSIONS,
  LEGACY_MANAGER_DEFAULT_PERMISSIONS
};
