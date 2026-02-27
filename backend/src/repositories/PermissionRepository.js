const BaseRepository = require('./BaseRepository');
const Permission = require('../models/Permission');

class PermissionRepository extends BaseRepository {
  constructor() {
    super(Permission);
  }

  /**
   * Find permissions by category
   * @param {String} category - Permission category
   * @returns {Promise<Array>} Array of permissions
   */
  async findByCategory(category) {
    return await this.find({ category, isActive: true }, { sort: { displayName: 1 } });
  }

  /**
   * Find permissions by resource
   * @param {String} resource - Resource name
   * @returns {Promise<Array>} Array of permissions
   */
  async findByResource(resource) {
    return await this.find({ resource, isActive: true }, { sort: { action: 1 } });
  }

  /**
   * Create default permissions
   * @returns {Promise<Array>} Created permissions
   */
  async createDefaultPermissions() {
    const defaultPermissions = [
      // User Management
      {
        name: 'USER_MANAGEMENT_CREATE',
        displayName: 'Create Users',
        description: 'Create new user accounts',
        category: 'USER_MANAGEMENT',
        resource: 'USER',
        action: 'CREATE',
        level: 1
      },
      {
        name: 'USER_MANAGEMENT_READ',
        displayName: 'View Users',
        description: 'View user accounts and profiles',
        category: 'USER_MANAGEMENT',
        resource: 'USER',
        action: 'READ',
        level: 2
      },
      {
        name: 'USER_MANAGEMENT_UPDATE',
        displayName: 'Update Users',
        description: 'Update user accounts and profiles',
        category: 'USER_MANAGEMENT',
        resource: 'USER',
        action: 'UPDATE',
        level: 1
      },
      {
        name: 'USER_MANAGEMENT_DELETE',
        displayName: 'Delete Users',
        description: 'Delete user accounts',
        category: 'USER_MANAGEMENT',
        resource: 'USER',
        action: 'DELETE',
        level: 1
      },

      // Course Management
      {
        name: 'COURSE_MANAGEMENT_CREATE',
        displayName: 'Create Courses',
        description: 'Create new courses',
        category: 'COURSE_MANAGEMENT',
        resource: 'COURSE',
        action: 'CREATE',
        level: 2
      },
      {
        name: 'COURSE_MANAGEMENT_READ',
        displayName: 'View Courses',
        description: 'View course information',
        category: 'COURSE_MANAGEMENT',
        resource: 'COURSE',
        action: 'READ',
        level: 4
      },
      {
        name: 'COURSE_MANAGEMENT_UPDATE',
        displayName: 'Update Courses',
        description: 'Update course information',
        category: 'COURSE_MANAGEMENT',
        resource: 'COURSE',
        action: 'UPDATE',
        level: 2
      },
      {
        name: 'COURSE_MANAGEMENT_DELETE',
        displayName: 'Delete Courses',
        description: 'Delete courses',
        category: 'COURSE_MANAGEMENT',
        resource: 'COURSE',
        action: 'DELETE',
        level: 1
      },

      // Batch Management
      {
        name: 'BATCH_MANAGEMENT_CREATE',
        displayName: 'Create Batches',
        description: 'Create new course batches',
        category: 'BATCH_MANAGEMENT',
        resource: 'BATCH',
        action: 'CREATE',
        level: 2
      },
      {
        name: 'BATCH_MANAGEMENT_READ',
        displayName: 'View Batches',
        description: 'View batch information',
        category: 'BATCH_MANAGEMENT',
        resource: 'BATCH',
        action: 'READ',
        level: 4
      },
      {
        name: 'BATCH_MANAGEMENT_UPDATE',
        displayName: 'Update Batches',
        description: 'Update batch information',
        category: 'BATCH_MANAGEMENT',
        resource: 'BATCH',
        action: 'UPDATE',
        level: 2
      },
      {
        name: 'BATCH_MANAGEMENT_DELETE',
        displayName: 'Delete Batches',
        description: 'Delete batches',
        category: 'BATCH_MANAGEMENT',
        resource: 'BATCH',
        action: 'DELETE',
        level: 1
      },

      // Live Class Management
      {
        name: 'LIVE_CLASS_MANAGEMENT_CREATE',
        displayName: 'Create Live Classes',
        description: 'Schedule and create live classes',
        category: 'LIVE_CLASS_MANAGEMENT',
        resource: 'LIVE_CLASS',
        action: 'CREATE',
        level: 3
      },
      {
        name: 'LIVE_CLASS_MANAGEMENT_READ',
        displayName: 'View Live Classes',
        description: 'View live class information',
        category: 'LIVE_CLASS_MANAGEMENT',
        resource: 'LIVE_CLASS',
        action: 'READ',
        level: 4
      },
      {
        name: 'LIVE_CLASS_MANAGEMENT_UPDATE',
        displayName: 'Update Live Classes',
        description: 'Update live class information',
        category: 'LIVE_CLASS_MANAGEMENT',
        resource: 'LIVE_CLASS',
        action: 'UPDATE',
        level: 3
      },
      {
        name: 'LIVE_CLASS_MANAGEMENT_DELETE',
        displayName: 'Delete Live Classes',
        description: 'Delete live classes',
        category: 'LIVE_CLASS_MANAGEMENT',
        resource: 'LIVE_CLASS',
        action: 'DELETE',
        level: 2
      },

      // System Administration
      {
        name: 'SYSTEM_ADMINISTRATION_MANAGE',
        displayName: 'System Administration',
        description: 'Full system administration access',
        category: 'SYSTEM_ADMINISTRATION',
        resource: 'SYSTEM',
        action: 'MANAGE',
        level: 1
      },

      // Reporting
      {
        name: 'REPORTING_READ',
        displayName: 'View Reports',
        description: 'Access system reports and analytics',
        category: 'REPORTING',
        resource: 'REPORT',
        action: 'READ',
        level: 2
      }
    ];

    const createdPermissions = [];
    
    for (const permissionData of defaultPermissions) {
      const existingPermission = await this.findOne({ name: permissionData.name });
      if (!existingPermission) {
        const permission = await this.create(permissionData);
        createdPermissions.push(permission);
      }
    }

    return createdPermissions;
  }

  /**
   * Get all permissions grouped by category
   * @returns {Promise<Object>} Permissions grouped by category
   */
  async getGroupedByCategory() {
    const permissions = await this.find({ isActive: true }, { sort: { category: 1, displayName: 1 } });
    
    const grouped = {};
    permissions.forEach(permission => {
      if (!grouped[permission.category]) {
        grouped[permission.category] = [];
      }
      grouped[permission.category].push(permission);
    });

    return grouped;
  }
}

module.exports = PermissionRepository;