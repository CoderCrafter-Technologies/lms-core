const express = require('express');
const { body } = require('express-validator');
const { 
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicket,
  updateTicket,
  addReply,
  getTicketMessages,
  addTicketMessage,
  approveLeaveRequest,
  rejectLeaveRequest,
  getDashboardStats
} = require('../controllers/supportController');
const { authenticateToken } = require('../middleware/auth');

// Get multer upload middleware from the controller
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/tickets/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

const router = express.Router();

// Validation middleware
const createTicketValidation = [
  body('type').isIn(['ticket', 'leave']).withMessage('Type must be ticket or leave'),
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required and must be less than 200 characters'),
  body('description').trim().isLength({ min: 1, max: 2000 }).withMessage('Description is required and must be less than 2000 characters'),
  body('priority').isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level')
];

const addReplyValidation = [
  body('message').trim().isLength({ min: 1, max: 2000 }).withMessage('Message is required and must be less than 2000 characters')
];

// All routes require authentication
router.use(authenticateToken);

// Ticket management routes
router.post('/tickets', upload.array('attachments', 5), createTicket);
router.get('/tickets/my', getMyTickets);
router.get('/tickets/all', getAllTickets); // Admin/Manager only
router.get('/tickets/:id', getTicket);
router.patch('/tickets/:id', updateTicket); // Admin/Manager only
router.post('/tickets/:id/reply', upload.array('attachments', 5), addReplyValidation, addReply);
router.get('/tickets/:id/messages', getTicketMessages);
router.post('/tickets/:id/messages', upload.array('attachments', 5), addReplyValidation, addTicketMessage);

// Leave request specific routes
router.post('/tickets/:id/approve', approveLeaveRequest); // Admin/Manager only
router.post('/tickets/:id/reject', rejectLeaveRequest); // Admin/Manager only

// Dashboard stats for admins
router.get('/dashboard/stats', getDashboardStats);

module.exports = router;
