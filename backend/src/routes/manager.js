const express = require('express');
const { requirePermission } = require('../middleware/auth');
const managerController = require('../controllers/managerController');

const router = express.Router();

router.get('/dashboard', requirePermission('REPORTING_READ'), managerController.getManagerDashboard);

module.exports = router;
