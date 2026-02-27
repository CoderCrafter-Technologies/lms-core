const jwt = require('jsonwebtoken');
const config = require('../config');
const { userRepository } = require('../repositories');
const { LEGACY_MANAGER_DEFAULT_PERMISSIONS } = require('../constants/managerPermissions');

/**
 * Authentication middleware to verify JWT tokens
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        code: 'TOKEN_MISSING',
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    // Get user details from database
    const user = await userRepository.findById(decoded.userId, {
      populate: { path: 'roleId', select: 'name displayName level' },
      select: '-password'
    });

    if (!user) {
      return res.status(401).json({
        code: 'TOKEN_INVALID',
        error: 'Access denied',
        message: 'Invalid token - user not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        code: 'ACCOUNT_DISABLED',
        error: 'Account disabled',
        message: 'Your account has been disabled'
      });
    }

    // Add user to request object
    req.user = user;
    req.userId = user.id;
    req.userRole = user.roleId;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        code: 'TOKEN_INVALID',
        error: 'Access denied',
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 'TOKEN_EXPIRED',
        error: 'Access denied',
        message: 'Token expired'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication failed'
    });
  }
};

/**
 * Role-based authorization middleware
 * @param {Array|String} allowedRoles - Allowed role names
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.userRole) {
        return res.status(401).json({
          error: 'Access denied',
          message: 'Authentication required'
        });
      }

      const userRoleName = req.userRole.name;
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      if (!roles.includes(userRoleName)) {
        return res.status(403).json({
          error: 'Access forbidden',
          message: 'Insufficient permissions',
          required: roles,
          current: userRoleName
        });
      }

      next();
    } catch (error) {
      console.error('Role authorization error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Authorization failed'
      });
    }
  };
};

/**
 * Permission-based authorization middleware
 * @param {String} requiredPermission - Required permission name
 */
const requirePermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.userRole) {
        return res.status(401).json({
          error: 'Access denied',
          message: 'Authentication required'
        });
      }

      const rolePermissions = {
        'ADMIN': ['*'], // Admin has all permissions
        'MANAGER': LEGACY_MANAGER_DEFAULT_PERMISSIONS,
        'INSTRUCTOR': [
          'COURSE_MANAGEMENT_READ',
          'BATCH_MANAGEMENT_READ',
          'LIVE_CLASS_MANAGEMENT_CREATE',
          'LIVE_CLASS_MANAGEMENT_READ',
          'LIVE_CLASS_MANAGEMENT_UPDATE',
          'CONTENT_MANAGEMENT_CREATE',
          'CONTENT_MANAGEMENT_READ',
          'CONTENT_MANAGEMENT_UPDATE'
        ],
        'STUDENT': [
          'COURSE_MANAGEMENT_READ',
          'BATCH_MANAGEMENT_READ',
          'LIVE_CLASS_MANAGEMENT_READ'
        ]
      };

      const userRoleName = req.userRole.name;
      let userPermissions = rolePermissions[userRoleName] || [];
      if (userRoleName === 'MANAGER') {
        userPermissions =
          Array.isArray(req.user?.managerPermissions) && req.user.managerPermissions.length > 0
            ? req.user.managerPermissions
            : LEGACY_MANAGER_DEFAULT_PERMISSIONS;
      }

      // Check if user has the required permission or wildcard permission
      const hasPermission = userPermissions.includes('*') || 
                           userPermissions.includes(requiredPermission);

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Access forbidden',
          message: 'Insufficient permissions',
          required: requiredPermission,
          userRole: userRoleName
        });
      }

      next();
    } catch (error) {
      console.error('Permission authorization error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Permission check failed'
      });
    }
  };
};

/**
 * Resource ownership middleware - check if user owns the resource
 * @param {String} paramName - URL parameter name (e.g., 'userId', 'courseId')
 * @param {String} allowedRoles - Roles that can bypass ownership check
 */
const requireOwnership = (paramName = 'userId', allowedRoles = ['ADMIN', 'MANAGER']) => {
  return (req, res, next) => {
    try {
      if (!req.user || !req.userRole) {
        return res.status(401).json({
          error: 'Access denied',
          message: 'Authentication required'
        });
      }

      const userRoleName = req.userRole.name;
      const resourceUserId = req.params[paramName];
      const currentUserId = req.userId;

      // Allow if user has privileged role
      if (allowedRoles.includes(userRoleName)) {
        return next();
      }

      // Allow if user owns the resource
      if (resourceUserId === currentUserId) {
        return next();
      }

      return res.status(403).json({
        error: 'Access forbidden',
        message: 'You can only access your own resources'
      });
    } catch (error) {
      console.error('Ownership authorization error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Ownership check failed'
      });
    }
  };
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // No token, continue without user
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);
    // Get user details
    const user = await userRepository.findById(decoded.userId, {
      populate: { path: 'roleId', select: 'name displayName level' },
      select: '-password'
    });

    if (user && user.isActive) {
      req.user = user;
      req.userId = user.id;
      req.userRole = user.roleId;
    }

    next();
  } catch (error) {
    // Silently continue without user if token is invalid
    next();
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireOwnership,
  optionalAuth
};
