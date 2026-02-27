const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    maxLength: 2000
  },
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attachments: [{
    filename: String,
    path: String,
    mimetype: String,
    size: Number
  }]
}, {
  timestamps: true
});

const ticketSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['ticket', 'leave'],
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    required: true,
    maxLength: 2000
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'resolved', 'approved', 'rejected'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // User who created the ticket
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // For leave requests
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  liveClassIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveClass'
  }],
  
  // For assignment to admin/manager
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Communication
  replies: [replySchema],
  
  // Leave request specific fields
  leaveStartDate: Date,
  leaveEndDate: Date,
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectedReason: String,
  
  // For notification management
  isUrgent: {
    type: Boolean,
    default: false
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  lastReminderAt: Date,
  
  // Metadata
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String],
  category: String, // For ticket categorization
  
  // File attachments
  attachments: [{
    filename: String,
    path: String,
    mimetype: String,
    size: Number,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
ticketSchema.index({ createdBy: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ type: 1, status: 1 });
ticketSchema.index({ courseId: 1, batchId: 1 });
ticketSchema.index({ status: 1, priority: 1 });
ticketSchema.index({ createdAt: -1 });

// Virtual for age in hours
ticketSchema.virtual('ageInHours').get(function() {
  return Math.round((Date.now() - this.createdAt) / (1000 * 60 * 60));
});

// Virtual for response time
ticketSchema.virtual('responseTime').get(function() {
  if (this.replies && this.replies.length > 0) {
    const firstReply = this.replies[0];
    return Math.round((firstReply.createdAt - this.createdAt) / (1000 * 60)); // in minutes
  }
  return null;
});

// Pre-save middleware
ticketSchema.pre('save', function(next) {
  // Set resolved timestamp when status changes to resolved
  if (this.isModified('status')) {
    if (this.status === 'resolved' && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
    if ((this.status === 'approved' || this.status === 'rejected') && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
  }
  
  // Set urgent flag for high priority or urgent tickets
  if (this.priority === 'urgent' || this.priority === 'high') {
    this.isUrgent = true;
  }
  
  next();
});

// Methods
ticketSchema.methods.addReply = function(message, fromUserId, attachments = []) {
  this.replies.push({
    message,
    from: fromUserId,
    attachments
  });
  return this.save();
};

ticketSchema.methods.approve = function(approvedBy) {
  this.status = 'approved';
  this.approvedBy = approvedBy;
  this.approvedAt = new Date();
  return this.save();
};

ticketSchema.methods.reject = function(rejectedBy, reason) {
  this.status = 'rejected';
  this.resolvedBy = rejectedBy;
  this.rejectedReason = reason;
  return this.save();
};

// Static methods for admin queries
ticketSchema.statics.getPendingCount = function() {
  return this.countDocuments({ status: 'pending' });
};

ticketSchema.statics.getUrgentTickets = function() {
  return this.find({ 
    isUrgent: true, 
    status: { $in: ['pending', 'in-progress'] } 
  }).populate('createdBy', 'firstName lastName email')
    .populate('courseId', 'title')
    .populate('batchId', 'name batchCode')
    .sort({ createdAt: -1 });
};

ticketSchema.statics.getTicketsNeedingAttention = function() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.find({
    status: 'pending',
    createdAt: { $lt: twentyFourHoursAgo },
    reminderSent: false
  });
};


module.exports = mongoose.model('Ticket', ticketSchema);



