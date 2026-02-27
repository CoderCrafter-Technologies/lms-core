const BaseRepository = require('./BaseRepository');
const Role = require('../models/Role');

class RoleRepository extends BaseRepository {
  constructor() {
    super(Role);
  }

  /**
   * Find role by name
   * @param {String} name - Role name
   * @returns {Promise<Object|null>} Role document or null
   */
  async findByName(name) {
    return await this.findOne({ name: name.toUpperCase() });
  }

  /**
   * Get all active roles
   * @returns {Promise<Array>} Array of active roles
   */
  async findActive() {
    return await this.find({ isActive: true }, { sort: { level: 1 } });
  }

  /**
   * Get role hierarchy
   * @returns {Promise<Array>} Roles sorted by hierarchy level
   */  
  async getHierarchy() {
    return await this.find({ isActive: true }, { sort: { level: 1 } });
  }

  /**
   * Create default system roles
   * @returns {Promise<Array>} Created roles
   */
  async createDefaultRoles() {
    const defaultRoles = [
      {
        name: 'ADMIN',
        displayName: 'Administrator',
        description: 'Full system access and user management',
        level: 1,
        isSystemRole: true
      },
      {
        name: 'MANAGER',
        displayName: 'Manager',
        description: 'Course and batch management with custom permissions',
        level: 2,
        isSystemRole: true
      },
      {
        name: 'INSTRUCTOR',
        displayName: 'Instructor',
        description: 'Course content creation and live class management',
        level: 3,
        isSystemRole: true
      },
      {
        name: 'STUDENT',
        displayName: 'Student',
        description: 'Course enrollment and participation',
        level: 4,
        isSystemRole: true
      }
    ];

    const createdRoles = [];
    
    for (const roleData of defaultRoles) {
      const existingRole = await this.findByName(roleData.name);
      if (!existingRole) {
        const role = await this.create(roleData);
        createdRoles.push(role);
      }
    }

    return createdRoles;
  }

  /**
   * Check if role can manage another role
   * @param {String} managerRoleId - Manager role ID
   * @param {String} targetRoleId - Target role ID
   * @returns {Promise<Boolean>} True if can manage
   */
  async canManage(managerRoleId, targetRoleId) {
    const [managerRole, targetRole] = await Promise.all([
      this.findById(managerRoleId),
      this.findById(targetRoleId)
    ]);

    if (!managerRole || !targetRole) return false;
    
    return managerRole.level < targetRole.level;
  }
}

module.exports = RoleRepository;