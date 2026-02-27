const mongoose = require('mongoose');

const monitoringPolicySchema = new mongoose.Schema({
  scope: {
    type: String,
    default: 'GLOBAL',
    unique: true,
    index: true
  },
  retentionDays: {
    type: Number,
    min: 1,
    max: 3650,
    default: 90
  },
  archiveWindowDays: {
    type: Number,
    min: 1,
    max: 365,
    default: 30
  },
  exportMaxRecords: {
    type: Number,
    min: 100,
    max: 100000,
    default: 5000
  },
  alertThresholds: {
    warnPerHour: {
      type: Number,
      min: 1,
      max: 50000,
      default: 100
    },
    errorPerHour: {
      type: Number,
      min: 1,
      max: 50000,
      default: 30
    },
    criticalPerHour: {
      type: Number,
      min: 1,
      max: 50000,
      default: 10
    },
    memoryRssMb: {
      type: Number,
      min: 128,
      max: 131072,
      default: 2048
    }
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
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

module.exports = mongoose.model('MonitoringPolicy', monitoringPolicySchema);
