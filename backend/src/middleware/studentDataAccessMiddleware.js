const { userRepository } = require('../repositories');
const { Types } = require('mongoose');

/**
 * Middleware to ensure students can only access their own data
 * while allowing admins/instructors to access any student's data
 * @param {String} studentIdParam - Name of the parameter containing student ID (default: 'studentId')
 * @returns {Function} Express middleware function
 */
const studentDataAccessMiddleware = (studentIdParam = 'studentId') => {
  return async (req, res, next) => {
    try {
      const requestingUserId = req.userId;
      const requestedStudentId = req.params[studentIdParam];
      
      if (!requestingUserId || !requestedStudentId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters'
        });
      }

      // Get requesting user's role
      const requestingUser = await userRepository.findById(requestingUserId, {
        populate: { path: 'roleId', select: 'name' }
      });

      if (!requestingUser) {
        return res.status(401).json({
          success: false,
          message: 'Requesting user not found'
        });
      }

      const requestingUserRole = requestingUser.roleId?.name?.toLowerCase();

      // Admins and instructors can access any student's data
      if (requestingUserRole === 'admin' || requestingUserRole === 'instructor') {
        return next();
      }

      // Students can only access their own data
      if (requestingUserRole === 'student') {
        // Convert both IDs to strings for comparison
        const requestingUserIdStr = requestingUser.id.toString();
        const requestedStudentIdStr = requestedStudentId.toString();
        
        if (requestingUserIdStr !== requestedStudentIdStr) {
          return res.status(403).json({
            success: false,
            message: 'Access denied - students can only access their own data'
          });
        }
        return next();
      }

      // Default deny for any other roles
      return res.status(403).json({
        success: false,
        message: 'Access denied - insufficient permissions'
      });

    } catch (error) {
      console.error('Student data access middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization error'
      });
    }
  };
};

module.exports = studentDataAccessMiddleware;