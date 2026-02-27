const BaseRepository = require('./BaseRepository');
const Resource = require('../models/Resource');

class ResourceRepository extends BaseRepository {
  constructor() {
    super(Resource);
  }

  /**
   * Find resources by course ID
   */
  async findByCourse(courseId, userRole = 'STUDENT', options = {}) {
    const accessLevels = this.getAccessLevels(userRole);
    
    const filter = {
      $or: [
        { 
          resourceLevel: 'COURSE',
          courseId,
          status: 'ACTIVE',
          accessLevel: { $in: accessLevels }
        },
        {
          resourceLevel: 'BATCH',
          courseId: null,
          status: 'ACTIVE',
          accessLevel: { $in: accessLevels }
        }
      ]
    };

    return this.model.find(filter)
      .populate('uploadedBy', 'firstName lastName email')
      .populate('courseId', 'title')
      .sort({ uploadedAt: -1 })
      .limit(options.limit || 0)
      .lean();
  }

  /**
   * Find resources by batch ID
   */
  async findByBatch(batchId, userRole = 'STUDENT', options = {}) {
    const accessLevels = this.getAccessLevels(userRole);
    
    const filter = {
      resourceLevel: 'BATCH',
      batchId,
      status: 'ACTIVE',
      accessLevel: { $in: accessLevels }
    };

    return this.model.find(filter)
      .populate('uploadedBy', 'firstName lastName email')
      .populate('batchId', 'name batchCode')
      .sort({ uploadedAt: -1 })
      .limit(options.limit || 0)
      .lean();
  }

  /**
   * Find resources by live class ID
   */
  async findByLiveClass(liveClassId, userRole = 'STUDENT', options = {}) {
    const accessLevels = this.getAccessLevels(userRole);
    
    const filter = {
      resourceLevel: 'CLASS',
      liveClassId,
      status: 'ACTIVE',
      accessLevel: { $in: accessLevels }
    };

    return this.model.find(filter)
      .populate('uploadedBy', 'firstName lastName email')
      .populate('liveClassId', 'title')
      .sort({ uploadedAt: -1 })
      .limit(options.limit || 0)
      .lean();
  }

  /**
   * Find all accessible resources for a user
   */
  async findAccessibleResources(userId, userRole, enrolledCourseIds = [], enrolledBatchIds = [], options = {}) {
    const accessLevels = this.getAccessLevels(userRole);
    const { page = 1, limit = 10, resourceType, search } = options;

    let filter = {
      status: 'ACTIVE',
      accessLevel: { $in: accessLevels }
    };

    // Add resource type filter
    if (resourceType) {
      filter.fileType = resourceType;
    }

    // Add search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Access control based on enrollment
    if (userRole === 'STUDENT') {
      filter.$or = [
        // Course-level resources from enrolled courses
        { 
          resourceLevel: 'COURSE',
          courseId: { $in: enrolledCourseIds }
        },
        // Batch-level resources from enrolled batches
        {
          resourceLevel: 'BATCH',
          batchId: { $in: enrolledBatchIds }
        },
        // Public resources
        {
          accessLevel: 'PUBLIC'
        }
      ];
    } else if (userRole === 'INSTRUCTOR') {
      // Instructors can see resources they uploaded or from courses they teach
      filter.$or = [
        { uploadedBy: userId },
        { accessLevel: { $in: ['PUBLIC', 'ENROLLED_ONLY', 'INSTRUCTOR_ONLY'] } }
      ];
    }
    // Admins see all resources (no additional filter needed)

    return this.paginate(filter, {
      page,
      limit,
      populate: [
        { path: 'uploadedBy', select: 'firstName lastName email' },
        { path: 'courseId', select: 'title' },
        { path: 'batchId', select: 'name batchCode' },
        { path: 'liveClassId', select: 'title' }
      ],
      sort: { uploadedAt: -1 }
    });
  }

  /**
   * Get resources uploaded by a user
   */
  async findByUploader(uploaderId, options = {}) {
    const filter = {
      uploadedBy: uploaderId,
      status: { $ne: 'DELETED' }
    };

    return this.paginate(filter, {
      ...options,
      populate: [
        { path: 'courseId', select: 'title' },
        { path: 'batchId', select: 'name batchCode' },
        { path: 'liveClassId', select: 'title' }
      ],
      sort: { uploadedAt: -1 }
    });
  }

  /**
   * Get resource statistics
   */
  async getResourceStats(filters = {}) {
    const pipeline = [
      { $match: { status: 'ACTIVE', ...filters } },
      {
        $group: {
          _id: null,
          totalResources: { $sum: 1 },
          totalDownloads: { $sum: '$downloadCount' },
          totalViews: { $sum: '$viewCount' },
          totalSize: { $sum: '$fileSize' },
          byType: {
            $push: {
              type: '$fileType',
              count: 1,
              size: '$fileSize'
            }
          },
          byLevel: {
            $push: {
              level: '$resourceLevel',
              count: 1
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalResources: 1,
          totalDownloads: 1,
          totalViews: 1,
          totalSize: 1,
          byType: 1,
          byLevel: 1
        }
      }
    ];

    const result = await this.model.aggregate(pipeline);
    return result[0] || {
      totalResources: 0,
      totalDownloads: 0,
      totalViews: 0,
      totalSize: 0,
      byType: [],
      byLevel: []
    };
  }

  /**
   * Increment download count
   */
  async incrementDownloadCount(resourceId) {
    return this.model.findByIdAndUpdate(
      resourceId,
      { 
        $inc: { downloadCount: 1 },
        $set: { lastDownloaded: new Date() }
      },
      { new: true }
    );
  }

  /**
   * Increment view count
   */
  async incrementViewCount(resourceId) {
    return this.model.findByIdAndUpdate(
      resourceId,
      { $inc: { viewCount: 1 } },
      { new: true }
    );
  }

  /**
   * Archive resource
   */
  async archiveResource(resourceId) {
    return this.findByIdAndUpdate(resourceId, {
      status: 'ARCHIVED',
      updatedAt: new Date()
    });
  }

  /**
   * Soft delete resource
   */
  async softDeleteResource(resourceId) {
    return this.findByIdAndUpdate(resourceId, {
      status: 'DELETED',
      updatedAt: new Date()
    });
  }

  /**
   * Get access levels based on user role
   * @private
   */
  getAccessLevels(userRole) {
    const accessLevels = ['PUBLIC'];
    
    if (userRole === 'STUDENT') {
      accessLevels.push('ENROLLED_ONLY');
    } else if (userRole === 'INSTRUCTOR') {
      accessLevels.push('ENROLLED_ONLY', 'INSTRUCTOR_ONLY');
    } else if (userRole === 'ADMIN') {
      accessLevels.push('ENROLLED_ONLY', 'INSTRUCTOR_ONLY', 'ADMIN_ONLY');
    }
    
    return accessLevels;
  }

  /**
   * Check if user can access resource
   */
  async canUserAccessResource(resourceId, userId, userRole, enrolledCourseIds = [], enrolledBatchIds = []) {
    const resource = await this.findById(resourceId);
    if (!resource || resource.status !== 'ACTIVE') {
      return false;
    }

    // Check expiry
    if (resource.expiresAt && resource.expiresAt < new Date()) {
      return false;
    }

    // Check access level
    const accessLevels = this.getAccessLevels(userRole);
    if (!accessLevels.includes(resource.accessLevel)) {
      return false;
    }

    // Check enrollment for enrolled-only resources
    if (resource.accessLevel === 'ENROLLED_ONLY' && userRole === 'STUDENT') {
      if (resource.resourceLevel === 'COURSE' && !enrolledCourseIds.includes(resource.courseId.toString())) {
        return false;
      }
      if (resource.resourceLevel === 'BATCH' && !enrolledBatchIds.includes(resource.batchId.toString())) {
        return false;
      }
    }

    return true;
  }
}

module.exports = ResourceRepository;