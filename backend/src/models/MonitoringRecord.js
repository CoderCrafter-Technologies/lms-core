const mongoose = require('mongoose');

const monitoringRecordSchema = new mongoose.Schema({
  category: {
    type: String,
    enum: ['LOG', 'EVENT', 'ERROR'],
    required: true,
    index: true
  },
  level: {
    type: String,
    enum: ['debug', 'info', 'warn', 'error', 'critical'],
    default: 'info',
    index: true
  },
  source: {
    type: String,
    trim: true,
    default: 'SYSTEM',
    index: true
  },
  action: {
    type: String,
    trim: true,
    default: ''
  },
  entityType: {
    type: String,
    trim: true,
    default: ''
  },
  entityId: {
    type: String,
    trim: true,
    default: ''
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxLength: 2000
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true
  },
  request: {
    requestId: { type: String, default: null },
    method: { type: String, default: null },
    path: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

monitoringRecordSchema.index({ category: 1, createdAt: -1 });
monitoringRecordSchema.index({ source: 1, createdAt: -1 });
monitoringRecordSchema.index({ level: 1, createdAt: -1 });
monitoringRecordSchema.index({ isArchived: 1, createdAt: -1 });


module.exports = mongoose.model('MonitoringRecord', monitoringRecordSchema);



