const express = require('express');
const { body, validationResult } = require('express-validator');
const { userRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole, requirePermission } = require('../middleware/auth');
const { selfOrRoleMiddleware } = require('../middleware/roleMiddleware');

const router = express.Router();

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination and filtering
 * @access  Private (Admin, Manager)
 */
router.get('/', requirePermission('USER_MANAGEMENT_READ'), asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, role, status, search } = req.query;
  
  const filters = {};
  if (role) filters.role = role;
  if (status) filters.status = status;
  if (search) filters.search = search;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit)
  };

  const result = await userRepository.findWithFilters(filters, options);
  
  res.json({
    users: result.documents,
    pagination: result.pagination
  });
}));

/**
 * @route   GET /api/users/stats
 * @desc    Get user statistics
 * @access  Private (Admin, Manager)
 */
router.get('/stats', requirePermission('USER_MANAGEMENT_READ'), asyncHandler(async (req, res) => {
  const stats = await userRepository.getStats();
  res.json(stats);
}));

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get('/:id', selfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin', 'manager'] }), asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const user = await userRepository.findById(id);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'User with the specified ID does not exist'
    });
  }

  res.json({ user });
}));

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile
 * @access  Private
 */
router.put('/:id', [
  body('firstName').optional().trim().notEmpty(),
  body('lastName').optional().trim().notEmpty(),
  body('phone').optional().isMobilePhone()
], selfOrRoleMiddleware({ paramName: 'id', bypassRoles: ['admin', 'manager'] }), asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }

  const { id } = req.params;
  const updates = req.body;

  const user = await userRepository.updateProfile(id, updates);
  if (!user) {
    return res.status(404).json({
      error: 'User not found',
      message: 'User with the specified ID does not exist'
    });
  }

  res.json({
    message: 'User updated successfully',
    user
  });
}));

module.exports = router;
