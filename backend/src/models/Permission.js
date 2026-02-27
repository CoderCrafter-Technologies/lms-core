const mongoose = require('mongoose');

// PostgreSQL equivalent: permissions table
const permissionSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
    // PostgreSQL: id SERIAL PRIMARY KEY
  },
  
  // Permission identification
  name: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    index: true
    // PostgreSQL: name VARCHAR(100) UNIQUE NOT NULL
  },
  
  displayName: {
    type: String,
    required: true
    // PostgreSQL: display_name VARCHAR(150) NOT NULL
  },
  
  description: {
    type: String,
    default: ''
    // PostgreSQL: description TEXT
  },
  
  // Permission categorization
  category: {
    type: String,
    required: true,
    enum: [
      'USER_MANAGEMENT',
      'COURSE_MANAGEMENT', 
      'BATCH_MANAGEMENT',
      'CONTENT_MANAGEMENT',
      'LIVE_CLASS_MANAGEMENT',
      'ASSESSMENT_MANAGEMENT',
      'REPORTING',
      'SYSTEM_ADMINISTRATION'
    ]
    // PostgreSQL: category VARCHAR(50) NOT NULL
  },
  
  // Resource and action for granular control
  resource: {
    type: String,
    required: true
    // PostgreSQL: resource VARCHAR(50) NOT NULL
  },
  
  action: {
    type: String,
    required: true,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE']
    // PostgreSQL: action VARCHAR(20) NOT NULL
  },
  
  // Permission level for hierarchy
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
    // PostgreSQL: level INTEGER DEFAULT 1
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
    // PostgreSQL: is_active BOOLEAN DEFAULT TRUE
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

// Compound indexes for performance
permissionSchema.index({ resource: 1, action: 1 });
permissionSchema.index({ category: 1 });
permissionSchema.index({ name: 1 });

// Virtual for permission key (resource:action)
permissionSchema.virtual('key').get(function() {
  return `${this.resource}:${this.action}`;
});

// Static methods
permissionSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true }).sort({ displayName: 1 });
};

permissionSchema.statics.findByResource = function(resource) {
  return this.find({ resource, isActive: true });
};

const Permission = mongoose.model('Permission', permissionSchema);

module.exports = Permission;