const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  type: {
    type: String,
    required: true,
    enum: [
      'CLASS_STARTING_SOON',
      'CLASS_SCHEDULED',
      'CLASS_CANCELLED',
      'CLASS_MISSED',
      'LIVE_CHAT_MESSAGE',
      'SUPPORT_TICKET_CREATED',
      'SUPPORT_TICKET_UPDATED',
      'SUPPORT_TICKET_REPLY',
      'ASSESSMENT_PUBLISHED',
      'ASSESSMENT_CREATED',
      'ASSESSMENT_SUBMITTED',
      'RESOURCE_ADDED',
      'BATCH_AUTO_CLASSES_SCHEDULED',
      'CUSTOM_ANNOUNCEMENT',
      'SYSTEM'
    ]
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxLength: 1000
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  readAt: {
    type: Date,
    default: null,
    index: true
  },
  isArchived: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

notificationSchema.index({ recipientId: 1, isArchived: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });


module.exports = mongoose.model('Notification', notificationSchema);



