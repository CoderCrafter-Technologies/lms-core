const mongoose = require('mongoose');

// PostgreSQL equivalent: role_permissions table (many-to-many junction)
const rolePermissionSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
    // PostgreSQL: id SERIAL PRIMARY KEY
  },
  
  // Foreign key references
  roleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true,
    index: true
    // PostgreSQL: role_id INTEGER REFERENCES roles(id)
  },
  
  permissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission',
    required: true,
    index: true
    // PostgreSQL: permission_id INTEGER REFERENCES permissions(id)
  },
  
  // Permission grant details
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // PostgreSQL: granted_by INTEGER REFERENCES users(id)
  },
  
  grantedAt: {
    type: Date,
    default: Date.now
    // PostgreSQL: granted_at TIMESTAMP DEFAULT NOW()
  },
  
  // Optional expiration for temporary permissions
  expiresAt: {
    type: Date,
    default: null
    // PostgreSQL: expires_at TIMESTAMP
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

// Compound unique index to prevent duplicate role-permission assignments
rolePermissionSchema.index({ roleId: 1, permissionId: 1 }, { unique: true });

// Additional indexes for performance
rolePermissionSchema.index({ roleId: 1, isActive: 1 });
rolePermissionSchema.index({ permissionId: 1, isActive: 1 });
rolePermissionSchema.index({ expiresAt: 1 });

// Virtual to check if permission is expired
rolePermissionSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual to check if permission is valid
rolePermissionSchema.virtual('isValid').get(function() {
  return this.isActive && !this.isExpired;
});

// Static methods
rolePermissionSchema.statics.findByRole = function(roleId) {
  return this.find({ roleId, isActive: true })
    .populate('permissionId')
    .populate('grantedBy', 'firstName lastName email');
};

rolePermissionSchema.statics.findByPermission = function(permissionId) {
  return this.find({ permissionId, isActive: true })
    .populate('roleId')
    .populate('grantedBy', 'firstName lastName email');
};

rolePermissionSchema.statics.hasPermission = async function(roleId, permissionId) {
  const assignment = await this.findOne({
    roleId,
    permissionId,
    isActive: true,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
  
  return !!assignment;
};

// Instance methods
rolePermissionSchema.methods.revoke = function(revokedBy) {
  this.isActive = false;
  this.revokedBy = revokedBy;
  this.revokedAt = new Date();
  return this.save();
};

const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);

module.exports = RolePermission;