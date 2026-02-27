const mongoose = require('mongoose');

// PostgreSQL equivalent: live_classes table
const liveClassSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
    // PostgreSQL: id SERIAL PRIMARY KEY
  },
  
  // Class identification
  title: {
    type: String,
    required: true,
    trim: true
    // PostgreSQL: title VARCHAR(200) NOT NULL
  },
  
  // Batch reference (Foreign Key)
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    index: true
    // PostgreSQL: batch_id INTEGER REFERENCES batches(id)
  },
  
  // Instructor reference (Foreign Key)
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
    // PostgreSQL: instructor_id INTEGER REFERENCES users(id)
  },
  
  // Class scheduling
  scheduledStartTime: {
    type: Date,
    required: true,
    index: true
    // PostgreSQL: scheduled_start_time TIMESTAMP NOT NULL
  },
  
  scheduledEndTime: {
    type: Date,
    required: true
    // PostgreSQL: scheduled_end_time TIMESTAMP NOT NULL
  },
  
  // Actual class times
  actualStartTime: {
    type: Date,
    default: null
    // PostgreSQL: actual_start_time TIMESTAMP
  },
  
  actualEndTime: {
    type: Date,
    default: null
    // PostgreSQL: actual_end_time TIMESTAMP
  },
  
  // Class description and agenda
  description: {
    type: String,
    default: ''
    // PostgreSQL: description TEXT
  },
  
  agenda: {
    type: String,
    default: ''
    // PostgreSQL: agenda TEXT
  },
  
  // WebRTC room configuration
  roomId: {
    type: String,
    required: true,
    index: true
    // PostgreSQL: room_id VARCHAR(100) UNIQUE NOT NULL
  },
  
  // Class status
  status: {
    type: String,
    enum: ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'],
    default: 'SCHEDULED'
    // PostgreSQL: status VARCHAR(20) DEFAULT 'SCHEDULED'
  },
  
  // Class settings
  settings: {
    maxParticipants: {
      type: Number,
      default: 100,
      min: 1
      // PostgreSQL: max_participants INTEGER DEFAULT 100
    },
    allowRecording: {
      type: Boolean,
      default: true
      // PostgreSQL: allow_recording BOOLEAN DEFAULT TRUE
    },
    allowScreenShare: {
      type: Boolean,
      default: true
      // PostgreSQL: allow_screen_share BOOLEAN DEFAULT TRUE
    },
    allowWhiteboard: {
      type: Boolean,
      default: true
      // PostgreSQL: allow_whiteboard BOOLEAN DEFAULT TRUE
    },
    allowChat: {
      type: Boolean,
      default: true
      // PostgreSQL: allow_chat BOOLEAN DEFAULT TRUE
    },
    allowStudentMic: {
      type: Boolean,
      default: false
      // PostgreSQL: allow_student_mic BOOLEAN DEFAULT FALSE
    },
    allowStudentCamera: {
      type: Boolean,
      default: false
      // PostgreSQL: allow_student_camera BOOLEAN DEFAULT FALSE
    },
    requireApproval: {
      type: Boolean,
      default: false
      // PostgreSQL: require_approval BOOLEAN DEFAULT FALSE
    }
  },
  
  // Recording information
  recording: {
    isRecorded: {
      type: Boolean,
      default: false
      // PostgreSQL: is_recorded BOOLEAN DEFAULT FALSE
    },
    recordingUrl: {
      type: String,
      default: null
      // PostgreSQL: recording_url VARCHAR(500)
    },
    recordingId: {
      type: String,
      default: null
      // PostgreSQL: recording_id VARCHAR(255)
    },
    recordingSize: {
      type: Number,
      default: 0
      // PostgreSQL: recording_size BIGINT DEFAULT 0
    },
    recordingDuration: {
      type: Number,
      default: 0
      // PostgreSQL: recording_duration INTEGER DEFAULT 0 (in seconds)
    }
  },
  
  // Attendance statistics
  stats: {
    totalParticipants: {
      type: Number,
      default: 0
      // PostgreSQL: total_participants INTEGER DEFAULT 0
    },
    peakParticipants: {
      type: Number,
      default: 0
      // PostgreSQL: peak_participants INTEGER DEFAULT 0
    },
    averageParticipants: {
      type: Number,
      default: 0
      // PostgreSQL: average_participants INTEGER DEFAULT 0
    },
    totalChatMessages: {
      type: Number,
      default: 0
      // PostgreSQL: total_chat_messages INTEGER DEFAULT 0
    }
  },
  
    // Attendance capture from realtime joins
  attendees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  attendanceRecords: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: null
    },
    leftAt: {
      type: Date,
      default: null
    },
    totalDurationMinutes: {
      type: Number,
      default: 0
    },
    attendancePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    status: {
      type: String,
      enum: ['PRESENT', 'LEFT_EARLY', 'ABSENT', 'UNKNOWN'],
      default: 'UNKNOWN'
    }
  }],

  notificationState: {
    startReminderSentAt: {
      type: Date,
      default: null
    },
    missedClassProcessedAt: {
      type: Date,
      default: null
    }
  },
  // Class materials and resources
  materials: [{
    type: {
      type: String,
      enum: ['PDF', 'VIDEO', 'AUDIO', 'IMAGE', 'DOCUMENT', 'LINK'],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      default: 0
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
    // PostgreSQL: Separate class_materials table
  }],
  
  // Class creator
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // PostgreSQL: created_by INTEGER REFERENCES users(id)
  },
  
  // Cancellation details
  cancellationReason: {
    type: String,
    default: null
    // PostgreSQL: cancellation_reason TEXT
  },
  
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
    // PostgreSQL: cancelled_by INTEGER REFERENCES users(id)
  },
  
  cancelledAt: {
    type: Date,
    default: null
    // PostgreSQL: cancelled_at TIMESTAMP
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

// Indexes for performance
liveClassSchema.index({ batchId: 1, scheduledStartTime: 1 });
liveClassSchema.index({ instructorId: 1, status: 1 });
liveClassSchema.index({ roomId: 1 });
liveClassSchema.index({ status: 1, scheduledStartTime: 1 });
liveClassSchema.index({ scheduledStartTime: 1 });

// Virtual for class duration (scheduled)
liveClassSchema.virtual('scheduledDuration').get(function() {
  return Math.floor((this.scheduledEndTime - this.scheduledStartTime) / (1000 * 60)); // in minutes
});

// Virtual for actual duration
liveClassSchema.virtual('actualDuration').get(function() {
  if (!this.actualStartTime || !this.actualEndTime) return null;
  return Math.floor((this.actualEndTime - this.actualStartTime) / (1000 * 60)); // in minutes
});

// Virtual for class status helpers
liveClassSchema.virtual('isLive').get(function() {
  return this.status === 'LIVE';
});

liveClassSchema.virtual('isScheduled').get(function() {
  return this.status === 'SCHEDULED';
});

liveClassSchema.virtual('hasEnded').get(function() {
  return this.status === 'ENDED';
});

// Virtual for time remaining
liveClassSchema.virtual('timeUntilStart').get(function() {
  if (this.status !== 'SCHEDULED') return null;
  const now = new Date();
  const diff = this.scheduledStartTime - now;
  return diff > 0 ? diff : 0;
});

// Pre-save middleware
liveClassSchema.pre('save', function(next) {
  // Generate room ID if not provided
  if (!this.roomId) {
    this.roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Update status based on timing
  const now = new Date();
  if (this.status === 'SCHEDULED' && this.actualStartTime && !this.actualEndTime) {
    this.status = 'LIVE';
  } else if (this.status === 'LIVE' && this.actualEndTime) {
    this.status = 'ENDED';
  }
  
  next();
});

// Validation
liveClassSchema.pre('save', function(next) {
  if (this.scheduledStartTime >= this.scheduledEndTime) {
    next(new Error('Scheduled start time must be before end time'));
  }
  
  if (this.actualStartTime && this.actualEndTime && this.actualStartTime >= this.actualEndTime) {
    next(new Error('Actual start time must be before end time'));
  }
  
  next();
});

// Static methods
liveClassSchema.statics.findByBatch = function(batchId) {
  return this.find({ batchId }).sort({ scheduledStartTime: 1 });
};

liveClassSchema.statics.findByInstructor = function(instructorId) {
  return this.find({ instructorId }).sort({ scheduledStartTime: -1 });
};

liveClassSchema.statics.findUpcoming = function() {
  const now = new Date();
  return this.find({
    status: 'SCHEDULED',
    scheduledStartTime: { $gt: now }
  }).sort({ scheduledStartTime: 1 });
};

liveClassSchema.statics.findLive = function() {
  return this.find({ status: 'LIVE' });
};

liveClassSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    scheduledStartTime: {
      $gte: startDate,
      $lte: endDate
    }
  }).sort({ scheduledStartTime: 1 });
};

// Instance methods
liveClassSchema.methods.startClass = function() {
  this.status = 'LIVE';
  this.actualStartTime = new Date();
  return this.save();
};

liveClassSchema.methods.endClass = function() {
  this.status = 'ENDED';
  this.actualEndTime = new Date();
  return this.save();
};

liveClassSchema.methods.cancelClass = function(reason, cancelledBy) {
  this.status = 'CANCELLED';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.cancelledAt = new Date();
  return this.save();
};

liveClassSchema.methods.updateStats = function(stats) {
  Object.assign(this.stats, stats);
  return this.save();
};

liveClassSchema.methods.addMaterial = function(material) {
  this.materials.push(material);
  return this.save();
};


const LiveClass = mongoose.model('LiveClass', liveClassSchema);

module.exports = LiveClass;



