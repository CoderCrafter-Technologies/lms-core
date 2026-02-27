const mongoose = require('mongoose');

// PostgreSQL equivalent: resources table
const resourceSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
    // PostgreSQL: id SERIAL PRIMARY KEY
  },
  
  // Resource identification
  title: {
    type: String,
    required: true,
    trim: true
    // PostgreSQL: title VARCHAR(200) NOT NULL
  },
  
  description: {
    type: String,
    trim: true
    // PostgreSQL: description TEXT
  },
  
  // File information
  fileName: {
    type: String,
    required: true
    // PostgreSQL: file_name VARCHAR(255) NOT NULL
  },
  
  originalName: {
    type: String,
    required: true
    // PostgreSQL: original_name VARCHAR(255) NOT NULL
  },
  
  fileType: {
    type: String,
    required: true,
    enum: ['PDF', 'VIDEO', 'AUDIO', 'IMAGE', 'DOCUMENT', 'PRESENTATION', 'SPREADSHEET', 'ARCHIVE', 'OTHER']
    // PostgreSQL: file_type VARCHAR(20) NOT NULL
  },
  
  mimeType: {
    type: String,
    required: true
    // PostgreSQL: mime_type VARCHAR(100) NOT NULL
  },
  
  fileSize: {
    type: Number,
    required: true,
    min: 0
    // PostgreSQL: file_size BIGINT NOT NULL
  },
  
  fileUrl: {
    type: String,
    required: true
    // PostgreSQL: file_url VARCHAR(500) NOT NULL
  },
  
  // Hierarchical resource assignment
  resourceLevel: {
    type: String,
    required: true,
    enum: ['COURSE', 'BATCH', 'CLASS'],
    index: true
    // PostgreSQL: resource_level VARCHAR(20) NOT NULL
  },
  
  // Reference IDs (only one should be populated based on resource level)
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    default: null,
    index: true
    // PostgreSQL: course_id INTEGER REFERENCES courses(id)
  },
  
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    default: null,
    index: true
    // PostgreSQL: batch_id INTEGER REFERENCES batches(id)
  },
  
  liveClassId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LiveClass',
    default: null,
    index: true
    // PostgreSQL: live_class_id INTEGER REFERENCES live_classes(id)
  },
  
  // Access control
  isPublic: {
    type: Boolean,
    default: false
    // PostgreSQL: is_public BOOLEAN DEFAULT FALSE
  },
  
  accessLevel: {
    type: String,
    enum: ['PUBLIC', 'ENROLLED_ONLY', 'INSTRUCTOR_ONLY', 'ADMIN_ONLY'],
    default: 'ENROLLED_ONLY'
    // PostgreSQL: access_level VARCHAR(20) DEFAULT 'ENROLLED_ONLY'
  },
  
  // Resource metadata
  downloadCount: {
    type: Number,
    default: 0,
    min: 0
    // PostgreSQL: download_count INTEGER DEFAULT 0
  },
  
  viewCount: {
    type: Number,
    default: 0,
    min: 0
    // PostgreSQL: view_count INTEGER DEFAULT 0
  },
  
  tags: [{
    type: String,
    trim: true
    // PostgreSQL: Separate resource_tags table
  }],
  
  // Upload information
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
    // PostgreSQL: uploaded_by INTEGER REFERENCES users(id)
  },
  
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
    // PostgreSQL: uploaded_at TIMESTAMP DEFAULT NOW()
  },
  
  // Resource status
  status: {
    type: String,
    enum: ['ACTIVE', 'ARCHIVED', 'DELETED'],
    default: 'ACTIVE',
    index: true
    // PostgreSQL: status VARCHAR(20) DEFAULT 'ACTIVE'
  },
  
  // Expiry for time-limited resources
  expiresAt: {
    type: Date,
    default: null
    // PostgreSQL: expires_at TIMESTAMP
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
resourceSchema.index({ resourceLevel: 1, courseId: 1 });
resourceSchema.index({ resourceLevel: 1, batchId: 1 });
resourceSchema.index({ resourceLevel: 1, liveClassId: 1 });
resourceSchema.index({ uploadedBy: 1, uploadedAt: -1 });
resourceSchema.index({ status: 1, accessLevel: 1 });
resourceSchema.index({ tags: 1 });
resourceSchema.index({ fileType: 1 });

// Validation middleware
resourceSchema.pre('save', function(next) {
  // Ensure only appropriate reference ID is set based on resource level
  if (this.resourceLevel === 'COURSE') {
    if (!this.courseId) {
      return next(new Error('Course ID is required for course-level resources'));
    }
    this.batchId = null;
    this.liveClassId = null;
  } else if (this.resourceLevel === 'BATCH') {
    if (!this.batchId) {
      return next(new Error('Batch ID is required for batch-level resources'));
    }
    this.courseId = null;
    this.liveClassId = null;
  } else if (this.resourceLevel === 'CLASS') {
    if (!this.liveClassId) {
      return next(new Error('Live Class ID is required for class-level resources'));
    }
    this.courseId = null;
    this.batchId = null;
  }
  
  next();
});

// Virtual for formatted file size
resourceSchema.virtual('formattedFileSize').get(function() {
  const bytes = this.fileSize;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Virtual for resource hierarchy path
resourceSchema.virtual('hierarchyPath').get(function() {
  if (this.resourceLevel === 'COURSE') return `Course/${this.courseId}`;
  if (this.resourceLevel === 'BATCH') return `Batch/${this.batchId}`;
  if (this.resourceLevel === 'CLASS') return `Class/${this.liveClassId}`;
  return 'Unknown';
});

// Static methods
resourceSchema.statics.findByCourse = function(courseId, userRole = 'STUDENT') {
  const accessLevels = ['PUBLIC'];
  
  if (userRole === 'STUDENT') {
    accessLevels.push('ENROLLED_ONLY');
  } else if (userRole === 'INSTRUCTOR') {
    accessLevels.push('ENROLLED_ONLY', 'INSTRUCTOR_ONLY');
  } else if (userRole === 'ADMIN') {
    accessLevels.push('ENROLLED_ONLY', 'INSTRUCTOR_ONLY', 'ADMIN_ONLY');
  }
  
  return this.find({
    courseId,
    status: 'ACTIVE',
    accessLevel: { $in: accessLevels }
  }).populate('uploadedBy', 'firstName lastName').sort({ uploadedAt: -1 });
};

resourceSchema.statics.findByBatch = function(batchId, userRole = 'STUDENT') {
  const accessLevels = ['PUBLIC'];
  
  if (userRole === 'STUDENT') {
    accessLevels.push('ENROLLED_ONLY');
  } else if (userRole === 'INSTRUCTOR') {
    accessLevels.push('ENROLLED_ONLY', 'INSTRUCTOR_ONLY');
  } else if (userRole === 'ADMIN') {
    accessLevels.push('ENROLLED_ONLY', 'INSTRUCTOR_ONLY', 'ADMIN_ONLY');
  }
  
  return this.find({
    batchId,
    status: 'ACTIVE',
    accessLevel: { $in: accessLevels }
  }).populate('uploadedBy', 'firstName lastName').sort({ uploadedAt: -1 });
};

resourceSchema.statics.findByLiveClass = function(liveClassId, userRole = 'STUDENT') {
  const accessLevels = ['PUBLIC'];
  
  if (userRole === 'STUDENT') {
    accessLevels.push('ENROLLED_ONLY');
  } else if (userRole === 'INSTRUCTOR') {
    accessLevels.push('ENROLLED_ONLY', 'INSTRUCTOR_ONLY');
  } else if (userRole === 'ADMIN') {
    accessLevels.push('ENROLLED_ONLY', 'INSTRUCTOR_ONLY', 'ADMIN_ONLY');
  }
  
  return this.find({
    liveClassId,
    status: 'ACTIVE',
    accessLevel: { $in: accessLevels }
  }).populate('uploadedBy', 'firstName lastName').sort({ uploadedAt: -1 });
};

// Instance methods
resourceSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  return this.save();
};

resourceSchema.methods.incrementView = function() {
  this.viewCount += 1;
  return this.save();
};

resourceSchema.methods.isAccessibleBy = function(userRole, isEnrolled = false) {
  if (this.status !== 'ACTIVE') return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  
  switch (this.accessLevel) {
    case 'PUBLIC':
      return true;
    case 'ENROLLED_ONLY':
      return isEnrolled;
    case 'INSTRUCTOR_ONLY':
      return ['INSTRUCTOR', 'ADMIN'].includes(userRole);
    case 'ADMIN_ONLY':
      return userRole === 'ADMIN';
    default:
      return false;
  }
};


const Resource = mongoose.model('Resource', resourceSchema);

module.exports = Resource;



