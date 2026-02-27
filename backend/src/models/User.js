const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// PostgreSQL equivalent: users table
const userSchema = new mongoose.Schema({
  // Primary key equivalent
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
    // PostgreSQL: id SERIAL PRIMARY KEY
  },
  
  // Basic user information
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
    // PostgreSQL: email VARCHAR(255) UNIQUE NOT NULL
  },
  
  password: {
    type: String,
    required: true,
    minlength: 6
    // PostgreSQL: password_hash VARCHAR(255) NOT NULL
  },
  
  firstName: {
    type: String,
    required: true,
    trim: true
    // PostgreSQL: first_name VARCHAR(100) NOT NULL
  },
  
  lastName: {
    type: String,
    required: true,
    trim: true
    // PostgreSQL: last_name VARCHAR(100) NOT NULL
  },
  
  // Avatar/Profile image
  avatar: {
    url: {
      type: String,
      default: null
      // PostgreSQL: avatar_url VARCHAR(500)
    },
    publicId: {
      type: String,
      default: null
      // PostgreSQL: avatar_public_id VARCHAR(255)
    }
  },
  
  // Contact information
  phone: {
    type: String,
    default: null
    // PostgreSQL: phone VARCHAR(20)
  },
  
  // Role reference (Foreign Key equivalent)
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true,
    index: true
    // PostgreSQL: role_id INTEGER REFERENCES roles(id)
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
    // PostgreSQL: is_active BOOLEAN DEFAULT TRUE
  },
  
  isEmailVerified: {
    type: Boolean,
    default: false
    // PostgreSQL: is_email_verified BOOLEAN DEFAULT FALSE
  },

  mustSetPassword: {
    type: Boolean,
    default: false
  },
  
  // Password reset
  passwordResetToken: {
    type: String,
    default: null
    // PostgreSQL: password_reset_token VARCHAR(255)
  },
  
  passwordResetExpires: {
    type: Date,
    default: null
    // PostgreSQL: password_reset_expires TIMESTAMP
  },
  
  // Email verification
  emailVerificationToken: {
    type: String,
    default: null
    // PostgreSQL: email_verification_token VARCHAR(255)
  },
  emailVerificationOtp: {
    codeHash: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    purpose: { type: String, default: null }
  },
  
  // Last login tracking
  lastLogin: {
    type: Date,
    default: null
    // PostgreSQL: last_login TIMESTAMP
  },
  
  // Login attempts for security
  loginAttempts: {
    type: Number,
    default: 0
    // PostgreSQL: login_attempts INTEGER DEFAULT 0
  },
  
  lockUntil: {
    type: Date,
    default: null
    // PostgreSQL: lock_until TIMESTAMP
  },

  // Account security preferences
  securitySettings: {
    allowConcurrentSessions: {
      type: Boolean,
      default: true
    },
    loginAlerts: {
      type: Boolean,
      default: true
    },
    requireReauthForSensitiveActions: {
      type: Boolean,
      default: false
    }
  },

  notificationSettings: {
    inAppEnabled: {
      type: Boolean,
      default: true
    },
    browserPushEnabled: {
      type: Boolean,
      default: true
    },
    digestEnabled: {
      type: Boolean,
      default: false
    },
    digestFrequency: {
      type: String,
      enum: ['DAILY', 'WEEKLY'],
      default: 'DAILY'
    },
    digestHourUTC: {
      type: Number,
      min: 0,
      max: 23,
      default: 18
    },
    mutedTypes: {
      type: [String],
      default: []
    },
    mutedPriorities: {
      type: [String],
      default: []
    },
    quietHours: {
      enabled: {
        type: Boolean,
        default: false
      },
      startHourUTC: {
        type: Number,
        min: 0,
        max: 23,
        default: 22
      },
      endHourUTC: {
        type: Number,
        min: 0,
        max: 23,
        default: 7
      }
    },
    lastDigestSentAt: {
      type: Date,
      default: null
    }
  },

  // Manager-scoped custom permissions (applies when role is MANAGER)
  managerPermissions: {
    type: [String],
    default: []
  },

  managedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  // Timestamps for created_at and updated_at
  timestamps: true,
  // PostgreSQL: created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  
  // Optimize for lean queries (PostgreSQL compatibility)
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.emailVerificationToken;
      delete ret.emailVerificationOtp;
      return ret;
    }
  }
});

// Indexes for performance (equivalent to PostgreSQL indexes)
userSchema.index({ email: 1 });
userSchema.index({ roleId: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account lock status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware for password hashing
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 2 * 60 * 60 * 1000; // 2 hours
  
  // If we're hitting max attempts, lock the account
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true });
};


// Model compilation
const User = mongoose.model('User', userSchema);

module.exports = User;



