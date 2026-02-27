const mongoose = require('mongoose');

// PostgreSQL equivalent: courses table
const courseSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
    // PostgreSQL: id SERIAL PRIMARY KEY
  },
  
  // Course basic information
  title: {
    type: String,
    required: true,
    trim: true,
    index: true
    // PostgreSQL: title VARCHAR(200) NOT NULL
  },
  
  slug: {
    type: String,
    required: true,
    lowercase: true,
    index: true
    // PostgreSQL: slug VARCHAR(250) UNIQUE NOT NULL
  },
  
  description: {
    type: String,
    required: true
    // PostgreSQL: description TEXT NOT NULL
  },
  
  shortDescription: {
    type: String,
    maxlength: 500
    // PostgreSQL: short_description VARCHAR(500)
  },
  
  // Course media
  thumbnail: {
    url: {
      type: String,
      default: null
      // PostgreSQL: thumbnail_url VARCHAR(500)
    },
    publicId: {
      type: String,
      default: null
      // PostgreSQL: thumbnail_public_id VARCHAR(255)
    }
  },
  
  // Course categorization
  category: {
    type: String,
    required: true,
    enum: [
      'PROGRAMMING',
      'DATA_SCIENCE',
      'DESIGN',
      'BUSINESS',
      'MARKETING',
      'LANGUAGE',
      'OTHER'
    ]
    // PostgreSQL: category VARCHAR(50) NOT NULL
  },
  
  tags: [{
    type: String,
    trim: true
    // PostgreSQL: Separate tags table with course_id reference
  }],
  
  // Course difficulty and duration
  level: {
    type: String,
    required: true,
    enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
    default: 'BEGINNER'
    // PostgreSQL: level VARCHAR(20) NOT NULL
  },
  
  estimatedDuration: {
    hours: {
      type: Number,
      min: 0
      // PostgreSQL: estimated_hours INTEGER
    },
    minutes: {
      type: Number,
      min: 0,
      max: 59
      // PostgreSQL: estimated_minutes INTEGER
    }
  },
  
  // Pricing
  pricing: {
    type: {
      type: String,
      enum: ['FREE', 'PAID', 'SUBSCRIPTION'],
      default: 'FREE'
      // PostgreSQL: pricing_type VARCHAR(20)
    },
    amount: {
      type: Number,
      min: 0,
      default: 0
      // PostgreSQL: price_amount DECIMAL(10,2)
    },
    currency: {
      type: String,
      default: 'USD',
      maxlength: 3
      // PostgreSQL: currency VARCHAR(3)
    }
  },
  
  // Course creator and instructors
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
    // PostgreSQL: created_by INTEGER REFERENCES users(id)
  },
  
  // NOTE: Instructors as separate reference (not embedded array)
  // PostgreSQL: course_instructors table with course_id and instructor_id
  
  // Course status and visibility
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
    default: 'DRAFT'
    // PostgreSQL: status VARCHAR(20) DEFAULT 'DRAFT'
  },

  // Course authoring lifecycle and approvals
  authoringWorkflow: {
    approvalRequired: {
      type: Boolean,
      default: true
    },
    stage: {
      type: String,
      enum: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'DRAFT'
    },
    submittedForReviewAt: {
      type: Date,
      default: null
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewNotes: {
      type: String,
      default: ''
    }
  },
  
  isPublic: {
    type: Boolean,
    default: true
    // PostgreSQL: is_public BOOLEAN DEFAULT TRUE
  },
  
  // Prerequisites (as separate references, not embedded)
  // PostgreSQL: course_prerequisites table
  
  // Course metrics
  enrollmentCount: {
    type: Number,
    default: 0,
    min: 0
    // PostgreSQL: enrollment_count INTEGER DEFAULT 0
  },
  
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
    // PostgreSQL: average_rating DECIMAL(3,2) DEFAULT 0
  },
  
  totalRatings: {
    type: Number,
    default: 0,
    min: 0
    // PostgreSQL: total_ratings INTEGER DEFAULT 0
  },
  
  // SEO and metadata
  metaTitle: {
    type: String,
    maxlength: 60
    // PostgreSQL: meta_title VARCHAR(60)
  },
  
  metaDescription: {
    type: String,
    maxlength: 160
    // PostgreSQL: meta_description VARCHAR(160)
  },
  
  // Course publishing
  publishedAt: {
    type: Date,
    default: null
    // PostgreSQL: published_at TIMESTAMP
  },

  // Curriculum model + immutable snapshots for versioned curriculum workflow.
  curriculum: {
    modules: [{
      id: {
        type: String,
        required: true
      },
      title: {
        type: String,
        required: true
      },
      description: {
        type: String,
        default: ''
      },
      order: {
        type: Number,
        default: 0
      },
      lessons: [{
        id: {
          type: String,
          required: true
        },
        title: {
          type: String,
          required: true
        },
        type: {
          type: String,
          enum: ['video', 'reading', 'quiz', 'assignment', 'live-class', 'other'],
          default: 'other'
        },
        durationMinutes: {
          type: Number,
          default: 0
        },
        order: {
          type: Number,
          default: 0
        },
        isRequired: {
          type: Boolean,
          default: true
        }
      }]
    }]
  },
  curriculumVersions: [{
    versionNumber: {
      type: Number,
      required: true
    },
    label: {
      type: String,
      default: ''
    },
    changeSummary: {
      type: String,
      default: ''
    },
    workflowStage: {
      type: String,
      enum: ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'DRAFT'
    },
    curriculum: {
      modules: [{
        id: String,
        title: String,
        description: String,
        order: Number,
        lessons: [{
          id: String,
          title: String,
          type: String,
          durationMinutes: Number,
          order: Number,
          isRequired: Boolean
        }]
      }]
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    approvedAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  activeCurriculumVersion: {
    type: Number,
    default: 1
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
courseSchema.index({ title: 'text', description: 'text' }); // Full-text search
courseSchema.index({ slug: 1 });
courseSchema.index({ category: 1 });
courseSchema.index({ level: 1 });
courseSchema.index({ status: 1 });
courseSchema.index({ createdBy: 1 });
courseSchema.index({ 'pricing.type': 1 });
courseSchema.index({ publishedAt: -1 });
courseSchema.index({ averageRating: -1 });
courseSchema.index({ enrollmentCount: -1 });
courseSchema.index({ 'authoringWorkflow.stage': 1 });
courseSchema.index({ activeCurriculumVersion: 1 });

// Virtual for course URL
courseSchema.virtual('url').get(function() {
  return `/courses/${this.slug}`;
});

// Virtual for formatted duration
courseSchema.virtual('formattedDuration').get(function() {
  const hours = this.estimatedDuration?.hours || 0;
  const minutes = this.estimatedDuration?.minutes || 0;
  
  if (hours === 0 && minutes === 0) return 'Duration not set';
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} hr`;
  return `${hours} hr ${minutes} min`;
});

// Virtual for pricing display
courseSchema.virtual('priceDisplay').get(function() {
  if (this.pricing.type === 'FREE') return 'Free';
  return `${this.pricing.currency} ${this.pricing.amount}`;
});

// Pre-save middleware
courseSchema.pre('save', function(next) {
  // Generate slug from title if not provided
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'PUBLISHED' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  next();
});

// Static methods
courseSchema.statics.findPublished = function() {
  return this.find({ status: 'PUBLISHED', isPublic: true });
};

courseSchema.statics.findByCategory = function(category) {
  return this.find({ category, status: 'PUBLISHED', isPublic: true });
};

courseSchema.statics.searchCourses = function(query) {
  return this.find({
    $text: { $search: query },
    status: 'PUBLISHED',
    isPublic: true
  }).select({ score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } });
};

// Instance methods
courseSchema.methods.updateRating = async function(newRating) {
  const total = (this.averageRating * this.totalRatings) + newRating;
  this.totalRatings += 1;
  this.averageRating = total / this.totalRatings;
  return this.save();
};

courseSchema.methods.incrementEnrollment = function() {
  this.enrollmentCount += 1;
  return this.save();
};


const Course = mongoose.model('Course', courseSchema);

module.exports = Course;



