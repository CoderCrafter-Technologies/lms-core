const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['theory', 'mcq', 'coding'],
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
  totalPoints: {
    type: Number,
    default: 0
  }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer', 'essay', 'fill-blank', 'coding'],
    required: true
  },
  sectionId: {
    type: String,
    default: null
  },
  question: {
    type: String,
    required: true
  },
  options: [{
    id: String,
    text: String,
    isCorrect: Boolean
  }],
  correctAnswer: mongoose.Schema.Types.Mixed, // For different question types
  points: {
    type: Number,
    default: 1
  },
  explanation: String,
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  coding: {
    allowedLanguages: [{
      type: String
    }],
    starterCode: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    testCases: [{
      input: String,
      expectedOutput: String,
      isHidden: {
        type: Boolean,
        default: false
      },
      weight: {
        type: Number,
        default: 1
      }
    }]
  },
  tags: [String],
  order: {
    type: Number,
    default: 0
  }
}, { _id: false });

const assessmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    maxLength: 1000
  },
  instructions: {
    general: {
      type: String,
      default: '',
      maxLength: 3000
    },
    additional: {
      type: String,
      default: '',
      maxLength: 3000
    }
  },
  type: {
    type: String,
    enum: ['quiz', 'exam', 'assignment', 'practice'],
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: false // null means for all batches of the course
  },
  moduleId: String, // Reference to course module
  lessonId: String, // Reference to specific lesson
  
  // Assessment configuration
  settings: {
    timeLimit: {
      type: Number, // in minutes
      default: null // null means no time limit
    },
    attempts: {
      type: Number,
      default: 1 // number of allowed attempts
    },
    shuffleQuestions: {
      type: Boolean,
      default: false
    },
    shuffleOptions: {
      type: Boolean,
      default: false
    },
    showResults: {
      type: String,
      enum: ['immediately', 'after-deadline', 'manual', 'never'],
      default: 'immediately'
    },
    showCorrectAnswers: {
      type: Boolean,
      default: true
    },
    allowReview: {
      type: Boolean,
      default: true
    },
    requireCamera: {
      type: Boolean,
      default: false
    },
    requireFullScreen: {
      type: Boolean,
      default: false
    },
    preventCopyPaste: {
      type: Boolean,
      default: false
    },
    latePolicy: {
      mode: {
        type: String,
        enum: ['disallow', 'allow', 'grace-period', 'penalty'],
        default: 'allow'
      },
      graceMinutes: {
        type: Number,
        default: 0
      },
      penaltyPercentPerDay: {
        type: Number,
        default: 0
      },
      maxPenaltyPercent: {
        type: Number,
        default: 100
      }
    },
    revisionPolicy: {
      maxRevisions: {
        type: Number,
        default: 0
      },
      allowResubmissionAfterGrading: {
        type: Boolean,
        default: false
      },
      revisionWindowDays: {
        type: Number,
        default: 0
      }
    },
    plagiarismPolicy: {
      enabled: {
        type: Boolean,
        default: false
      },
      provider: {
        type: String,
        default: ''
      },
      similarityThreshold: {
        type: Number,
        default: 30
      },
      autoFlag: {
        type: Boolean,
        default: true
      }
    }
  },

  // Questions
  sections: [sectionSchema],
  questions: [questionSchema],

  // Grading
  grading: {
    totalPoints: {
      type: Number,
      default: 0
    },
    passingScore: {
      type: Number,
      default: 60 // percentage
    },
    gradingMethod: {
      type: String,
      enum: ['automatic', 'manual', 'hybrid'],
      default: 'automatic'
    },
    weightage: {
      type: Number,
      default: 100 // percentage of course grade
    },
    rubric: {
      scoringMode: {
        type: String,
        enum: ['points', 'weighted-percentage'],
        default: 'points'
      },
      criteria: [{
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
        maxPoints: {
          type: Number,
          default: 0
        },
        weight: {
          type: Number,
          default: 1
        }
      }]
    }
  },

  // Scheduling
  schedule: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    startDate: Date,
    endDate: Date,
    timezone: String
  },

  // Status and metadata
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'deleted'],
    default: 'draft'
  },
  publishedAt: Date,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Statistics
  stats: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    },
    passRate: {
      type: Number,
      default: 0
    },
    completionRate: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
assessmentSchema.index({ courseId: 1, status: 1 });
assessmentSchema.index({ batchId: 1, status: 1 });
assessmentSchema.index({ createdBy: 1 });
assessmentSchema.index({ 'schedule.startDate': 1, 'schedule.endDate': 1 });

// Virtual for duration in minutes
assessmentSchema.virtual('duration').get(function() {
  if (this.schedule.startDate && this.schedule.endDate) {
    return Math.round((this.schedule.endDate - this.schedule.startDate) / (1000 * 60));
  }
  return this.settings.timeLimit;
});

// Pre-save middleware to calculate total points
assessmentSchema.pre('save', function(next) {
  if (this.isModified('questions')) {
    this.grading.totalPoints = this.questions.reduce((total, question) => total + question.points, 0);
  }

  if (this.isModified('questions') || this.isModified('sections')) {
    this.sections = (this.sections || []).map((section) => {
      const sectionTotal = (this.questions || [])
        .filter((question) => question.sectionId === section.id)
        .reduce((sum, question) => sum + (question.points || 0), 0);
      return {
        ...section,
        totalPoints: sectionTotal
      };
    });
  }

  next();
});

// Pre-save middleware to set published date
assessmentSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  next();
});


module.exports = mongoose.model('Assessment', assessmentSchema);



