const mongoose = require('mongoose');

// PostgreSQL equivalent: batches table
const batchSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
    // PostgreSQL: id SERIAL PRIMARY KEY
  },
  
  // Batch identification
  name: {
    type: String,
    required: true,
    trim: true
    // PostgreSQL: name VARCHAR(150) NOT NULL
  },
  
  // Course reference (Foreign Key)
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
    index: true
    // PostgreSQL: course_id INTEGER REFERENCES courses(id)
  },
  
  // Batch code for easy identification
  batchCode: {
    type: String,
    required: true,
    uppercase: true,
    index: true
    // PostgreSQL: batch_code VARCHAR(20) UNIQUE NOT NULL
  },
  
  // Batch schedule
  startDate: {
    type: Date,
    required: true,
    index: true
    // PostgreSQL: start_date DATE NOT NULL
  },
  
  endDate: {
    type: Date,
    required: true,
    index: true
    // PostgreSQL: end_date DATE NOT NULL
  },
  
  // Batch timing
  schedule: {
    days: [{
      type: String,
      enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
      // PostgreSQL: Separate batch_schedule table
    }],
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      // PostgreSQL: start_time TIME NOT NULL
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
      // PostgreSQL: end_time TIME NOT NULL
    },
    timezone: {
      type: String,
      default: 'UTC'
      // PostgreSQL: timezone VARCHAR(50) DEFAULT 'UTC'
    }
  },
  
  // Batch capacity
  maxStudents: {
    type: Number,
    required: true,
    min: 1,
    max: 500
    // PostgreSQL: max_students INTEGER NOT NULL
  },
  
  currentEnrollment: {
    type: Number,
    default: 0,
    min: 0
    // PostgreSQL: current_enrollment INTEGER DEFAULT 0
  },
  
  // Batch instructor (Foreign Key)
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
    // PostgreSQL: instructor_id INTEGER REFERENCES users(id)
  },
  
  // Batch status
  status: {
    type: String,
    enum: ['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
    default: 'UPCOMING'
    // PostgreSQL: status VARCHAR(20) DEFAULT 'UPCOMING'
  },
  
  // Batch settings
  settings: {
    allowLateJoin: {
      type: Boolean,
      default: false
      // PostgreSQL: allow_late_join BOOLEAN DEFAULT FALSE
    },
    autoEnrollment: {
      type: Boolean,
      default: false
      // PostgreSQL: auto_enrollment BOOLEAN DEFAULT FALSE
    },
    recordClasses: {
      type: Boolean,
      default: true
      // PostgreSQL: record_classes BOOLEAN DEFAULT TRUE
    },
    allowStudentChat: {
      type: Boolean,
      default: true
      // PostgreSQL: allow_student_chat BOOLEAN DEFAULT TRUE
    }
  },
  
  // Batch description
  description: {
    type: String,
    default: ''
    // PostgreSQL: description TEXT
  },
  
  // Prerequisites
  prerequisites: {
    type: String,
    default: ''
    // PostgreSQL: prerequisites TEXT
  },
  
  // Batch creation
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // PostgreSQL: created_by INTEGER REFERENCES users(id)
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
batchSchema.index({ courseId: 1, status: 1 });
batchSchema.index({ instructorId: 1, status: 1 });
batchSchema.index({ startDate: 1 });
batchSchema.index({ endDate: 1 });
batchSchema.index({ batchCode: 1 });
batchSchema.index({ status: 1 });

// Virtual for enrollment status
batchSchema.virtual('isFull').get(function() {
  return this.currentEnrollment >= this.maxStudents;
});

// Virtual for batch progress
batchSchema.virtual('isStarted').get(function() {
  return new Date() >= this.startDate;
});

batchSchema.virtual('isEnded').get(function() {
  return new Date() >= this.endDate;
});

// Virtual for available spots
batchSchema.virtual('availableSpots').get(function() {
  return this.maxStudents - this.currentEnrollment;
});

// Virtual for duration
batchSchema.virtual('duration').get(function() {
  const start = this.startDate;
  const end = this.endDate;
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Pre-save middleware
batchSchema.pre('save', function(next) {
  // Auto-generate batch code if not provided
  if (!this.batchCode) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.batchCode = `BATCH-${date}-${random}`;
  }
  
  // Update status based on dates
  const now = new Date();
  if (this.status === 'UPCOMING' && now >= this.startDate && now <= this.endDate) {
    this.status = 'ACTIVE';
  } else if (this.status === 'ACTIVE' && now > this.endDate) {
    this.status = 'COMPLETED';
  }
  
  next();
});

// Validation
batchSchema.pre('save', function(next) {
  if (this.startDate >= this.endDate) {
    next(new Error('Start date must be before end date'));
  }
  
  if (this.schedule.startTime >= this.schedule.endTime) {
    next(new Error('Start time must be before end time'));
  }
  
  next();
});

// Static methods
batchSchema.statics.findByCourse = function(courseId) {
  return this.find({ courseId }).populate('instructorId', 'firstName lastName email');
};

batchSchema.statics.findByInstructor = function(instructorId) {
  return this.find({ instructorId }).populate('courseId', 'title');
};

batchSchema.statics.findUpcoming = function() {
  return this.find({ 
    status: 'UPCOMING',
    startDate: { $gt: new Date() }
  }).sort({ startDate: 1 });
};

batchSchema.statics.findActive = function() {
  return this.find({ status: 'ACTIVE' });
};

// Instance methods
batchSchema.methods.incrementEnrollment = function() {
  if (this.currentEnrollment < this.maxStudents) {
    this.currentEnrollment += 1;
    return this.save();
  }
  throw new Error('Batch is full');
};

batchSchema.methods.decrementEnrollment = function() {
  if (this.currentEnrollment > 0) {
    this.currentEnrollment -= 1;
    return this.save();
  }
  throw new Error('No enrollments to remove');
};

batchSchema.methods.canEnroll = function() {
  return this.status === 'UPCOMING' && 
         this.currentEnrollment < this.maxStudents &&
         (this.settings.allowLateJoin || new Date() < this.startDate);
};


const Batch = mongoose.model('Batch', batchSchema);

module.exports = Batch;



