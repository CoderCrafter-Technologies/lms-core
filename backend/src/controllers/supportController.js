const Ticket = require('../models/Ticket');
const { userRepository, courseRepository, batchRepository } = require('../repositories');
const notificationService = require('../services/notificationService');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  }
});

const TICKET_THREAD_POPULATE = [
  { path: 'createdBy', select: 'firstName lastName email roleId' },
  { path: 'courseId', select: 'title' },
  { path: 'batchId', select: 'name batchCode' },
  { path: 'liveClassIds', select: 'name scheduledAt' },
  { path: 'assignedTo', select: 'firstName lastName' },
  { path: 'approvedBy', select: 'firstName lastName' },
  { path: 'resolvedBy', select: 'firstName lastName' },
  { path: 'replies.from', select: 'firstName lastName roleId email' }
];

const normalizeId = (value, seen = new Set()) => {
  if (!value) return null;
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    if (seen.has(value)) return null;
    seen.add(value);

    // Handle BSON/Mongoose ObjectId directly.
    if (value.constructor?.name === 'ObjectId') {
      return value.toString();
    }

    if (value._id && value._id !== value) {
      return normalizeId(value._id, seen);
    }
  }

  if (typeof value.toString === 'function') {
    const id = value.toString();
    return id === '[object Object]' ? null : id;
  }

  return null;
};

const idsEqual = (left, right) => {
  const leftId = normalizeId(left);
  const rightId = normalizeId(right);
  return Boolean(leftId && rightId && leftId === rightId);
};

const canAccessTicket = (ticket, req) => {
  const isOwner = idsEqual(ticket.createdBy, req.userId) || idsEqual(ticket.createdBy, req.user?._id);
  const isAdmin = ['ADMIN', 'MANAGER'].includes(req.user.roleId.name);
  const isAssigned =
    idsEqual(ticket.assignedTo, req.userId) ||
    idsEqual(ticket.assignedTo, req.user?._id);
  return { isOwner, isAdmin, isAssigned, allowed: isOwner || isAdmin || isAssigned };
};

const getAdminManagerRecipientIds = async () => {
  const users = await userRepository.find({}, {
    populate: { path: 'roleId', select: 'name' },
    select: 'isActive roleId'
  });

  return users
    .filter((user) => user.isActive && ['ADMIN', 'MANAGER'].includes(user.roleId?.name))
    .map((user) => user.id?.toString())
    .filter(Boolean);
};

/**
 * Create new ticket or leave request
 */
const createTicket = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const {
    type,
    title,
    description,
    priority,
    courseId,
    batchId,
    liveClassIds,
    category
  } = req.body;

  // Handle file attachments
  const attachments = req.files ? req.files.map(file => ({
    filename: file.originalname,
    path: file.path,
    mimetype: file.mimetype,
    size: file.size,
    uploadedBy: req.userId
  })) : [];

  // Validate leave request specific requirements
  if (type === 'leave') {
    if (!courseId || !batchId || !liveClassIds || liveClassIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Leave requests require course, batch, and at least one class selection'
      });
    }
  }

  // Create ticket
  const ticketData = {
    type,
    title,
    description,
    priority,
    createdBy: req.userId,
    category,
    attachments
  };

  // Add leave-specific fields
  if (type === 'leave') {
    ticketData.courseId = courseId;
    ticketData.batchId = batchId;
    ticketData.liveClassIds = liveClassIds;
  }

  const ticket = await Ticket.create(ticketData);

  // Populate the created ticket for response
  await ticket.populate([
    { path: 'createdBy', select: 'firstName lastName email' },
    { path: 'courseId', select: 'title' },
    { path: 'batchId', select: 'name batchCode' }
  ]);

  const adminManagerRecipients = await getAdminManagerRecipientIds();
  await notificationService.createForUsers(adminManagerRecipients, {
    actorId: req.userId,
    type: 'SUPPORT_TICKET_CREATED',
    title: type === 'leave' ? 'New leave request' : 'New support ticket',
    message: `${title} was created and needs review.`,
    priority: priority === 'urgent' ? 'urgent' : (priority === 'high' ? 'high' : 'normal'),
    data: {
      ticketId: ticket._id.toString(),
      ticketType: type,
      status: ticket.status
    }
  });

  res.status(201).json({
    success: true,
    message: `${type === 'leave' ? 'Leave request' : 'Ticket'} created successfully`,
    data: ticket
  });
});

/**
 * Get user's tickets
 */
const getMyTickets = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, type } = req.query;
  
  const filters = { createdBy: req.userId };
  if (status) filters.status = status;
  if (type) filters.type = type;

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    populate: [
      { path: 'courseId', select: 'title' },
      { path: 'batchId', select: 'name batchCode' },
      { path: 'replies.from', select: 'firstName lastName' }
    ],
    sort: { createdAt: -1 }
  };

  // Manual pagination since we're using Ticket model directly
  const skip = (page - 1) * limit;
  const tickets = await Ticket.find(filters)
    .populate(options.populate)
    .sort(options.sort)
    .skip(skip)
    .limit(limit);
  
  const total = await Ticket.countDocuments(filters);
  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: tickets,
    pagination: {
      currentPage: page,
      totalPages,
      total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  });
});

/**
 * Get all tickets (Admin/Manager view)
 */
const getAllTickets = asyncHandler(async (req, res) => {
  // Check if user is admin or manager
  if (!['ADMIN', 'MANAGER'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Manager role required.'
    });
  }

  const { 
    page = 1, 
    limit = 10, 
    status, 
    type, 
    priority, 
    courseId, 
    batchId,
    urgent
  } = req.query;
  
  const filters = {};
  if (status) filters.status = status;
  if (type) filters.type = type;
  if (priority) filters.priority = priority;
  if (courseId) filters.courseId = courseId;
  if (batchId) filters.batchId = batchId;
  if (urgent === 'true') filters.isUrgent = true;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const tickets = await Ticket.find(filters)
    .populate([
      { path: 'createdBy', select: 'firstName lastName email' },
      { path: 'courseId', select: 'title' },
      { path: 'batchId', select: 'name batchCode' },
      { path: 'assignedTo', select: 'firstName lastName' },
      { path: 'replies.from', select: 'firstName lastName' }
    ])
    .sort({ isUrgent: -1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  const total = await Ticket.countDocuments(filters);
  const totalPages = Math.ceil(total / parseInt(limit));

  // Get summary stats
  const stats = await Ticket.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const urgentCount = await Ticket.countDocuments({ 
    isUrgent: true, 
    status: { $in: ['pending', 'in-progress'] } 
  });

  res.json({
    success: true,
    data: tickets,
    pagination: {
      currentPage: parseInt(page),
      totalPages,
      total,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    stats: {
      byStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      urgent: urgentCount
    }
  });
});

/**
 * Get single ticket details
 */
const getTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const ticket = await Ticket.findById(id)
    .populate(TICKET_THREAD_POPULATE);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
  }

  // Check access permissions
  const access = canAccessTicket(ticket, req);
  if (!access.allowed) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.json({
    success: true,
    data: ticket
  });
});

/**
 * Update ticket status or assign ticket
 */
const updateTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, assignedTo, priority, category } = req.body;
  
  // Check if user is admin or manager
  if (!['ADMIN', 'MANAGER'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Manager role required.'
    });
  }

  const ticket = await Ticket.findById(id);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
  }

  const updates = {};
  if (status) updates.status = status;
  if (assignedTo) updates.assignedTo = assignedTo;
  if (priority) updates.priority = priority;
  if (category) updates.category = category;

  // Set resolved fields if status is being changed to resolved/approved/rejected
  if (status && ['resolved', 'approved', 'rejected'].includes(status)) {
    updates.resolvedBy = req.userId;
    updates.resolvedAt = new Date();
  }

  const updatedTicket = await Ticket.findByIdAndUpdate(
    id, 
    updates, 
    { new: true }
  ).populate([
    { path: 'createdBy', select: 'firstName lastName email' },
    { path: 'courseId', select: 'title' },
    { path: 'batchId', select: 'name batchCode' },
    { path: 'assignedTo', select: 'firstName lastName' },
    { path: 'resolvedBy', select: 'firstName lastName' }
  ]);

  await notificationService.createForUser({
    recipientId: updatedTicket.createdBy?._id || updatedTicket.createdBy,
    actorId: req.userId,
    type: 'SUPPORT_TICKET_UPDATED',
    title: 'Support ticket updated',
    message: `Your ticket "${updatedTicket.title}" was updated to ${updatedTicket.status}.`,
    priority: updatedTicket.priority === 'urgent' ? 'urgent' : 'normal',
    data: { ticketId: updatedTicket._id.toString(), status: updatedTicket.status }
  });

  res.json({
    success: true,
    message: 'Ticket updated successfully',
    data: updatedTicket
  });
});

/**
 * Add reply to ticket
 */
const addReply = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const attachments = req.files
    ? req.files.map((file) => ({
        filename: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      }))
    : [];

  if (!message || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message is required'
    });
  }

  const ticket = await Ticket.findById(id);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
  }

  // Check access permissions
  const access = canAccessTicket(ticket, req);
  if (!access.allowed) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Add reply
  await ticket.addReply(message.trim(), req.userId, attachments);

  // Update status if it's pending and admin is replying
  if (ticket.status === 'pending' && access.isAdmin) {
    ticket.status = 'in-progress';
    await ticket.save();
  }

  // Populate and return updated ticket
  await ticket.populate([
    { path: 'replies.from', select: 'firstName lastName roleId' },
    { path: 'createdBy', select: 'firstName lastName email' }
  ]);

  const replyRecipients = [ticket.createdBy?._id || ticket.createdBy, ticket.assignedTo?._id || ticket.assignedTo]
    .filter((id) => id && id.toString() !== req.userId.toString())
    .map((id) => id.toString());

  await notificationService.createForUsers(replyRecipients, {
    actorId: req.userId,
    type: 'SUPPORT_TICKET_REPLY',
    title: 'New reply on support ticket',
    message: `A new reply was added on "${ticket.title}".`,
    priority: 'normal',
    data: { ticketId: ticket._id.toString() }
  });

  res.json({
    success: true,
    message: 'Reply added successfully',
    data: ticket
  });
});

/**
 * Get threaded messages for a ticket
 */
const getTicketMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ticket = await Ticket.findById(id).populate(TICKET_THREAD_POPULATE);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
  }

  const access = canAccessTicket(ticket, req);
  if (!access.allowed) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  res.json({
    success: true,
    data: {
      ticketId: ticket._id,
      title: ticket.title,
      status: ticket.status,
      type: ticket.type,
      messages: ticket.replies || []
    }
  });
});

/**
 * Add message to ticket thread
 */
const addTicketMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  const attachments = req.files
    ? req.files.map((file) => ({
        filename: file.originalname,
        path: file.path,
        mimetype: file.mimetype,
        size: file.size
      }))
    : [];

  if (!message || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Message is required'
    });
  }

  const ticket = await Ticket.findById(id);
  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Ticket not found'
    });
  }

  const access = canAccessTicket(ticket, req);
  if (!access.allowed) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  await ticket.addReply(message.trim(), req.userId, attachments);

  if (ticket.status === 'pending' && access.isAdmin) {
    ticket.status = 'in-progress';
    await ticket.save();
  }

  await ticket.populate(TICKET_THREAD_POPULATE);

  const threadRecipients = [ticket.createdBy?._id || ticket.createdBy, ticket.assignedTo?._id || ticket.assignedTo]
    .filter((id) => id && id.toString() !== req.userId.toString())
    .map((id) => id.toString());

  await notificationService.createForUsers(threadRecipients, {
    actorId: req.userId,
    type: 'SUPPORT_TICKET_REPLY',
    title: 'New ticket thread message',
    message: `A new message was posted on "${ticket.title}".`,
    priority: 'normal',
    data: { ticketId: ticket._id.toString() }
  });

  res.json({
    success: true,
    message: 'Thread message added successfully',
    data: ticket
  });
});

/**
 * Approve leave request
 */
const approveLeaveRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  // Check if user is admin or manager
  if (!['ADMIN', 'MANAGER'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Manager role required.'
    });
  }

  const ticket = await Ticket.findById(id).populate([
    { path: 'createdBy', select: 'firstName lastName email' },
    { path: 'courseId', select: 'title' },
    { path: 'batchId', select: 'name batchCode' },
    { path: 'liveClassIds', select: 'name scheduledAt' }
  ]);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Leave request not found'
    });
  }

  if (ticket.type !== 'leave') {
    return res.status(400).json({
      success: false,
      message: 'This is not a leave request'
    });
  }

  // Approve the leave request
  await ticket.approve(req.userId);

  // Add approval message if provided
  if (message) {
    await ticket.addReply(message, req.userId);
  }

  await notificationService.createForUser({
    recipientId: ticket.createdBy?._id || ticket.createdBy,
    actorId: req.userId,
    type: 'SUPPORT_TICKET_UPDATED',
    title: 'Leave request approved',
    message: `Your leave request "${ticket.title}" has been approved.`,
    priority: 'high',
    data: { ticketId: ticket._id.toString(), status: 'approved' }
  });

  res.json({
    success: true,
    message: 'Leave request approved successfully',
    data: ticket
  });
});

/**
 * Reject leave request
 */
const rejectLeaveRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  // Check if user is admin or manager
  if (!['ADMIN', 'MANAGER'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Manager role required.'
    });
  }

  const ticket = await Ticket.findById(id).populate([
    { path: 'createdBy', select: 'firstName lastName email' },
    { path: 'courseId', select: 'title' },
    { path: 'batchId', select: 'name batchCode' }
  ]);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: 'Leave request not found'
    });
  }

  if (ticket.type !== 'leave') {
    return res.status(400).json({
      success: false,
      message: 'This is not a leave request'
    });
  }

  // Reject the leave request
  await ticket.reject(req.userId, reason);

  // Add rejection message
  if (reason) {
    await ticket.addReply(`Leave request rejected. Reason: ${reason}`, req.userId);
  }

  await notificationService.createForUser({
    recipientId: ticket.createdBy?._id || ticket.createdBy,
    actorId: req.userId,
    type: 'SUPPORT_TICKET_UPDATED',
    title: 'Leave request rejected',
    message: `Your leave request "${ticket.title}" was rejected.`,
    priority: 'high',
    data: { ticketId: ticket._id.toString(), status: 'rejected', reason }
  });

  res.json({
    success: true,
    message: 'Leave request rejected successfully',
    data: ticket
  });
});

/**
 * Get dashboard statistics for admins
 */
const getDashboardStats = asyncHandler(async (req, res) => {
  // Check if user is admin or manager
  if (!['ADMIN', 'MANAGER'].includes(req.user.roleId.name)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Manager role required.'
    });
  }

  const stats = await Promise.all([
    Ticket.countDocuments({ status: 'pending' }),
    Ticket.countDocuments({ status: 'in-progress' }),
    Ticket.countDocuments({ type: 'leave', status: 'pending' }),
    Ticket.countDocuments({ isUrgent: true, status: { $in: ['pending', 'in-progress'] } }),
    Ticket.getTicketsNeedingAttention().then(tickets => tickets.length)
  ]);

  const recentTickets = await Ticket.find({ status: { $in: ['pending', 'in-progress'] } })
    .populate('createdBy', 'firstName lastName')
    .populate('courseId', 'title')
    .populate('batchId', 'name')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      pendingTickets: stats[0],
      inProgressTickets: stats[1],
      pendingLeaveRequests: stats[2],
      urgentTickets: stats[3],
      ticketsNeedingAttention: stats[4],
      recentTickets
    }
  });
});

module.exports = {
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
  getDashboardStats,
  upload
};
