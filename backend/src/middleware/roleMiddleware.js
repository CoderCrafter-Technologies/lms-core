const { userRepository, roleRepository } = require('../repositories');
const { LEGACY_MANAGER_DEFAULT_PERMISSIONS } = require('../constants/managerPermissions');

const resolveCrudPermission = (domain, method) => {
  if (method === 'GET') return `${domain}_READ`;
  if (method === 'POST') return `${domain}_CREATE`;
  if (method === 'PUT' || method === 'PATCH') return `${domain}_UPDATE`;
  if (method === 'DELETE') return `${domain}_DELETE`;
  return null;
};

const getManagerRequiredPermission = (req) => {
  const method = req.method.toUpperCase();
  const path = req.originalUrl || req.baseUrl || req.path || '';

  if (path.startsWith('/api/users') || path.startsWith('/api/instructors') || path.startsWith('/api/students')) {
    return resolveCrudPermission('USER_MANAGEMENT', method);
  }

  if (path.startsWith('/api/courses')) {
    return resolveCrudPermission('COURSE_MANAGEMENT', method);
  }

  if (path.startsWith('/api/batches')) {
    return resolveCrudPermission('BATCH_MANAGEMENT', method);
  }

  if (path.startsWith('/api/live-classes')) {
    return resolveCrudPermission('LIVE_CLASS_MANAGEMENT', method);
  }

  if (path.startsWith('/api/support')) {
    return method === 'GET' ? 'SUPPORT_MANAGEMENT_READ' : 'SUPPORT_MANAGEMENT_UPDATE';
  }

  if (path.startsWith('/api/admin/dashboard') || path.startsWith('/api/admin/analytics')) {
    return 'REPORTING_READ';
  }

  return null;
};

const resolveRoleName = (roleValue) => {
  if (!roleValue) return '';
  if (typeof roleValue === 'string') return roleValue.toLowerCase();
  if (typeof roleValue === 'object' && roleValue.name) {
    return String(roleValue.name).toLowerCase();
  }
  return '';
};

/**
 * Role-based access control middleware
 * @param {Array} allowedRoles - Array of role names that are allowed
 * @returns {Function} Express middleware function
 */
const roleMiddleware = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      // Get user from previous auth middleware
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Get user with role information
      const user = await userRepository.findById(userId, {
        populate: { path: 'roleId', select: 'name permissions' }
      });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      if (!user.roleId) {
        return res.status(403).json({
          success: false,
          message: 'User role not assigned'
        });
      }

      const userRole = user.roleId.name.toLowerCase();

      // Check if user's role is in the allowed roles
      const hasPermission = allowedRoles.some(role => 
        role.toLowerCase() === userRole
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          required: allowedRoles,
          userRole: userRole
        });
      }

      // If manager is allowed by role for this endpoint, apply fine-grained custom permission checks.
      if (userRole === 'manager') {
        const requiredPermission = getManagerRequiredPermission(req);
        if (requiredPermission) {
          const managerPermissions =
            Array.isArray(user.managerPermissions) && user.managerPermissions.length > 0
              ? user.managerPermissions
              : LEGACY_MANAGER_DEFAULT_PERMISSIONS;

          const allowed =
            managerPermissions.includes('*') || managerPermissions.includes(requiredPermission);

          if (!allowed) {
            return res.status(403).json({
              success: false,
              message: 'Access denied',
              reason: 'Manager permission missing',
              requiredPermission
            });
          }
        }
      }

      // Add role information to request for use in controllers
      req.userRole = userRole;
      req.userPermissions = user.roleId.permissions || [];
      req.managerPermissions = Array.isArray(user.managerPermissions) ? user.managerPermissions : [];
      
      // Add commonly used role IDs to request
      if (userRole === 'admin') {
        req.isAdmin = true;
      } else if (userRole === 'instructor') {
        req.isInstructor = true;
      } else if (userRole === 'student') {
        req.isStudent = true;
        req.studentId = userId;
      }

      next();
    } catch (error) {
      console.error('Role middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

/**
 * Check specific permission middleware
 * @param {String} permission - Specific permission to check
 * @returns {Function} Express middleware function
 */
const permissionMiddleware = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const user = await userRepository.findById(userId, {
        populate: { path: 'roleId', select: 'name permissions' }
      });

      if (!user || !user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const userPermissions = user.roleId?.permissions || [];
      const hasPermission = userPermissions.includes(permission);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          required: permission
        });
      }

      next();
    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

/**
 * Resource ownership middleware
 * Checks if user owns the resource or has admin privileges
 * @param {String} resourceIdParam - Parameter name containing resource ID
 * @param {String} ownerField - Field name that contains owner ID in the resource
 * @returns {Function} Express middleware function
 */
const resourceOwnershipMiddleware = (resourceIdParam = 'id', ownerField = 'createdBy') => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      const resourceId = req.params[resourceIdParam];
      
      if (!userId || !resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters'
        });
      }

      // Get user role
      const user = await userRepository.findById(userId, {
        populate: { path: 'roleId', select: 'name' }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      const userRole = user.roleId?.name?.toLowerCase();

      // Admin has access to all resources
      if (userRole === 'admin') {
        req.isAdmin = true;
        return next();
      }

      // For students accessing their own profile/resources
      if (userRole === 'student' && resourceIdParam === 'id' && resourceId === userId) {
        req.isOwner = true;
        return next();
      }

      // TODO: Add more specific resource ownership checks based on the resource type
      // This would require knowing which repository/model to check against

      return res.status(403).json({
        success: false,
        message: 'Access denied - insufficient permissions'
      });

    } catch (error) {
      console.error('Resource ownership middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

/**
 * Batch enrollment check middleware
 * Checks if student is enrolled in the specified batch
 * @param {String} batchIdParam - Parameter name containing batch ID
 * @returns {Function} Express middleware function
 */
const batchEnrollmentMiddleware = (batchIdParam = 'id') => {
  return async (req, res, next) => {
    try {
      const userId = req.userId;
      const batchId = req.params[batchIdParam];
      
      if (!userId || !batchId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters'
        });
      }

      // Get user role
      const user = await userRepository.findById(userId, {
        populate: { path: 'roleId', select: 'name' }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      const userRole = user.roleId?.name?.toLowerCase();

      // Admin and instructors have access to all batches
      if (userRole === 'admin' || userRole === 'instructor') {
        return next();
      }

      // For students, check if they are enrolled in the batch
      if (userRole === 'student') {
        const { enrollmentRepository } = require('../repositories');
        
        const isEnrolled = await enrollmentRepository.isStudentEnrolled(userId, batchId);
        
        if (!isEnrolled) {
          return res.status(403).json({
            success: false,
            message: 'Access denied - not enrolled in this batch'
          });
        }

        req.isEnrolledStudent = true;
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });

    } catch (error) {
      console.error('Batch enrollment middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

/**
 * Allow request if user has any bypass role, otherwise enforce self ownership by route param.
 * Designed for routes where STUDENT/INSTRUCTOR can only access own record.
 * @param {Object} options
 * @param {String} options.paramName
 * @param {Array<String>} options.bypassRoles
 * @returns {Function}
 */
const selfOrRoleMiddleware = (options = {}) => {
  const paramName = options.paramName || 'id';
  const bypassRoles = Array.isArray(options.bypassRoles) && options.bypassRoles.length > 0
    ? options.bypassRoles.map((role) => String(role).toLowerCase())
    : ['admin'];

  return (req, res, next) => {
    try {
      const role = resolveRoleName(req.userRole);
      const userId = String(req.userId || '');
      const targetId = String(req.params?.[paramName] || '');

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!targetId) {
        return res.status(400).json({
          success: false,
          message: `Missing route parameter: ${paramName}`
        });
      }

      if (bypassRoles.includes(role)) {
        return next();
      }

      if (userId === targetId) {
        req.isOwner = true;
        return next();
      }

      return res.status(403).json({
        success: false,
        message: 'Access denied - you can only access your own record'
      });
    } catch (error) {
      console.error('Self/role ownership middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

const enrollmentSelfOrRoleMiddleware = (options = {}) => {
  const paramName = options.paramName || 'id';
  const bypassRoles = Array.isArray(options.bypassRoles) && options.bypassRoles.length > 0
    ? options.bypassRoles.map((role) => String(role).toLowerCase())
    : ['admin', 'instructor'];

  return async (req, res, next) => {
    try {
      const role = resolveRoleName(req.userRole);
      const userId = String(req.userId || '');
      const enrollmentId = String(req.params?.[paramName] || '');

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!enrollmentId) {
        return res.status(400).json({
          success: false,
          message: `Missing route parameter: ${paramName}`
        });
      }

      if (bypassRoles.includes(role)) {
        return next();
      }

      if (role !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const { enrollmentRepository } = require('../repositories');
      const enrollment = await enrollmentRepository.findById(enrollmentId, { select: 'studentId' });
      if (!enrollment) {
        return res.status(404).json({
          success: false,
          message: 'Enrollment not found'
        });
      }

      const ownerId = String(enrollment.studentId?.id || enrollment.studentId?._id || enrollment.studentId || '');
      if (!ownerId || ownerId !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied - you can only access your own enrollment'
        });
      }

      req.isOwner = true;
      return next();
    } catch (error) {
      console.error('Enrollment ownership middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

module.exports = {
  roleMiddleware,
  permissionMiddleware,
  resourceOwnershipMiddleware,
  batchEnrollmentMiddleware,
  selfOrRoleMiddleware,
  enrollmentSelfOrRoleMiddleware
};
