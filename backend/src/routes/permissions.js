const express = require('express');
const router = express.Router();

// Placeholder routes for permissions
router.get('/', (req, res) => {
  res.json({ message: 'Permissions endpoint - coming soon' });
});

module.exports = router;