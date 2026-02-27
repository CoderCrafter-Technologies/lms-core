const BaseRepository = require('./BaseRepository');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  /**
   * Find user by email
   * @param {String} email - User email
   * @returns {Promise<Object|null>} User document or null
   */
  async findByEmail(email) {
    return await this.findOne({ email: email.toLowerCase() }, {
      populate: { path: 'roleId', select: 'name displayName level' },
      lean: true
    });
  }

  /**
   * Find users by role
   * @param {String} roleId - Role ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of users
   */
  async findByRole(roleId, options = {}) {
    return await this.find({ roleId }, {
      ...options,
      populate: { path: 'roleId', select: 'name displayName' }
    });
  }

  /**
   * Find active users
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of active users
   */
  async findActive(options = {}) {
    return await this.find({ isActive: true }, {
      ...options,
      populate: { path: 'roleId', select: 'name displayName' }
    });
  }

  /**
   * Search users by name or email
   * @param {String} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of matching users
   */
  async search(searchTerm, options = {}) {
    const criteria = {
      $or: [
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ],
      isActive: true
    };

    return await this.find(criteria, {
      ...options,
      populate: { path: 'roleId', select: 'name displayName' },
      limit: options.limit || 10
    });
  }

  /**
   * Create user with role assignment
   * @param {Object} userData - User data
   * @param {String} roleId - Role ID
   * @returns {Promise<Object>} Created user
   */
  async createWithRole(userData, roleId) {
    const userWithRole = {
      ...userData,
      roleId,
      email: userData.email.toLowerCase()
    };

    const user = await this.create(userWithRole);
    
    // Populate role information
    return await this.findById(user.id, {
      populate: { path: 'roleId', select: 'name displayName level' }
    });
  }

  /**
   * Update user role
   * @param {String} userId - User ID
   * @param {String} newRoleId - New role ID
   * @returns {Promise<Object|null>} Updated user
   */
  async updateRole(userId, newRoleId) {
    return await this.updateById(userId, { roleId: newRoleId }, {
      populate: { path: 'roleId', select: 'name displayName level' }
    });
  }

  /**
   * Update user profile
   * @param {String} userId - User ID
   * @param {Object} profileData - Profile data
   * @returns {Promise<Object|null>} Updated user
   */
  async updateProfile(userId, profileData) {
    // Remove sensitive fields that shouldn't be updated via profile
    const { password, roleId, isActive, ...safeData } = profileData;
    
    return await this.updateById(userId, safeData, {
      populate: { path: 'roleId', select: 'name displayName level' }
    });
  }

  /**
   * Update user password
   * @param {String} userId - User ID
   * @param {String} newPassword - New password (will be hashed by model)
   * @returns {Promise<Object|null>} Updated user
   */
  async updatePassword(userId, newPassword) {
    const hashedPassword = await bcrypt.hash(String(newPassword || ''), 12);
    return await this.updateById(userId, {
      password: hashedPassword,
      passwordChangedAt: new Date()
    });
  }

  /**
   * Set password reset token
   * @param {String} email - User email
   * @param {String} token - Reset token
   * @param {Date} expiresAt - Token expiration
   * @returns {Promise<Object|null>} Updated user
   */
  async setPasswordResetToken(email, token, expiresAt) {
    return await this.updateById(
      { email: email.toLowerCase() },
      {
        passwordResetToken: token,
        passwordResetExpires: expiresAt
      }
    );
  }

  /**
   * Find user by password reset token
   * @param {String} token - Reset token
   * @returns {Promise<Object|null>} User or null
   */
  async findByPasswordResetToken(token) {
    return await this.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });
  }

  /**
   * Clear password reset token
   * @param {String} userId - User ID
   * @returns {Promise<Object|null>} Updated user
   */
  async clearPasswordResetToken(userId) {
    return await this.updateById(userId, {
      $unset: {
        passwordResetToken: 1,
        passwordResetExpires: 1
      }
    });
  }

  /**
   * Update last login
   * @param {String} userId - User ID
   * @returns {Promise<Object|null>} Updated user
   */
  async updateLastLogin(userId) {
    return await this.updateById(userId, {
      lastLogin: new Date(),
      loginAttempts: 0,
      $unset: { lockUntil: 1 }
    });
  }

  /**
   * Get user statistics
   * @returns {Promise<Object>} User statistics
   */
  async getStats() {
    const pipeline = [
      {
        $lookup: {
          from: 'roles',
          localField: 'roleId',
          foreignField: '_id',
          as: 'role'
        }
      },
      {
        $unwind: '$role'
      },
      {
        $group: {
          _id: '$role.name',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ];

    const roleStats = await this.aggregate(pipeline);
    const totalUsers = await this.count();
    const activeUsers = await this.count({ isActive: true });

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      byRole: roleStats
    };
  }

  /**
   * Get users with pagination and filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Paginated users
   */
  async findWithFilters(filters = {}, options = {}) {
    const criteria = {};

    // Apply filters
    if (filters.role) {
      criteria.roleId = filters.role;
    }

    if (filters.status) {
      criteria.isActive = filters.status === 'active';
    }

    if (filters.search) {
      criteria.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } }
      ];
    }

    return await this.paginate(criteria, {
      ...options,
      populate: { path: 'roleId', select: 'name displayName level' }
    });
  }

  /**
   * Bulk update users
   * @param {Array} userIds - Array of user IDs
   * @param {Object} updates - Update data
   * @returns {Promise<Object>} Update result
   */
  async bulkUpdate(userIds, updates) {
    return await this.updateMany(
      { _id: { $in: userIds } },
      updates
    );
  }

  /**
   * Deactivate user (soft delete)
   * @param {String} userId - User ID
   * @returns {Promise<Object|null>} Updated user
   */
  async deactivate(userId) {
    return await this.updateById(userId, { isActive: false });
  }

  /**
   * Activate user
   * @param {String} userId - User ID
   * @returns {Promise<Object|null>} Updated user
   */
  async activate(userId) {
    return await this.updateById(userId, { 
      isActive: true,
      loginAttempts: 0,
      $unset: { lockUntil: 1 }
    });
  }
}

module.exports = UserRepository;
