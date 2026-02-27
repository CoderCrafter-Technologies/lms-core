const mongoose = require('mongoose');

// PostgreSQL equivalent: roles table
const roleSchema = new mongoose.Schema({
  // Primary key equivalent
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
    // PostgreSQL: id SERIAL PRIMARY KEY
  },
  
  // Role identification
  name: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    enum: ['ADMIN', 'MANAGER', 'INSTRUCTOR', 'STUDENT'],
    index: true
    // PostgreSQL: name VARCHAR(50) UNIQUE NOT NULL
  },
  
  displayName: {
    type: String,
    required: true
    // PostgreSQL: display_name VARCHAR(100) NOT NULL
  },
  
  description: {
    type: String,
    default: ''
    // PostgreSQL: description TEXT
  },
  
  // Role hierarchy level (for permission inheritance)
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 10
    // PostgreSQL: level INTEGER NOT NULL
  },
  
  // Role status
  isActive: {
    type: Boolean,
    default: true
    // PostgreSQL: is_active BOOLEAN DEFAULT TRUE
  },
  
  // System role flag (cannot be deleted)
  isSystemRole: {
    type: Boolean,
    default: false
    // PostgreSQL: is_system_role BOOLEAN DEFAULT FALSE
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

// Indexes
roleSchema.index({ name: 1 });
roleSchema.index({ level: 1 });
roleSchema.index({ isActive: 1 });

// Static methods
roleSchema.statics.findByName = function(name) {
  return this.findOne({ name: name.toUpperCase() });
};

roleSchema.statics.findActiveRoles = function() {
  return this.find({ isActive: true }).sort({ level: 1 });
};

roleSchema.statics.getHierarchy = function() {
  return this.find({ isActive: true }).sort({ level: 1 });
};

// Instance methods
roleSchema.methods.canManage = function(targetRole) {
  return this.level < targetRole.level;
};

const Role = mongoose.model('Role', roleSchema);

module.exports = Role;