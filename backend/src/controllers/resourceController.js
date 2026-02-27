const { resourceRepository, enrollmentRepository, courseRepository, batchRepository } = require('../repositories');
const { asyncHandler } = require('../middleware/errorHandler');
const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const LiveClass = require('../models/LiveClass');
const notificationService = require('../services/notificationService');

/**
 * Get all resources with filtering and pagination
 */
const getResources = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { page = 1, limit = 10, resourceType, search, courseId, batchId, level } = req.query;
  const userRole = req.user.roleId.name;

  // Get user's enrollments for access control
  let enrolledCourseIds = [];
  let enrolledBatchIds = [];

  if (userRole === 'STUDENT') {
    const enrollments = await enrollmentRepository.findByStudentId(req.user.id);
    enrolledCourseIds = enrollments.map(e => e.courseId.toString());
    enrolledBatchIds = enrollments.map(e => e.batchId.toString());
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    resourceType,
    search
  };

  let result;

  if (level === 'course' && courseId) {
    result = await resourceRepository.findByCourse(courseId, userRole, options);
  } else if (level === 'batch' && batchId) {
    result = await resourceRepository.findByBatch(batchId, userRole, options);
  } else {
    result = await resourceRepository.findAccessibleResources(
      req.user.id, 
      userRole, 
      enrolledCourseIds, 
      enrolledBatchIds, 
      options
    );
  }

  res.json({
    success: true,
    data: result.documents || result,
    pagination: result.pagination
  });
});

/**
 * Get single resource by ID
 */
const getResource = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const userRole = req.user.roleId.name;

  // Get user's enrollments for access control
  let enrolledCourseIds = [];
  let enrolledBatchIds = [];

  if (userRole === 'STUDENT') {
    const enrollments = await enrollmentRepository.findByStudent(req.user.id);
    enrolledCourseIds = enrollments.map(e => e.courseId.id.toString());
    enrolledBatchIds = enrollments.map(e => e.batchId.id.toString());
  }

  // Check if user can access this resource
  const canAccess = await resourceRepository.canUserAccessResource(
    id, 
    req.user.id, 
    userRole, 
    enrolledCourseIds, 
    enrolledBatchIds
  );

  if (!canAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this resource'
    });
  }

  const resource = await resourceRepository.findById(id, {
    populate: [
      { path: 'uploadedBy', select: 'firstName lastName email' },
      { path: 'courseId', select: 'title' },
      { path: 'batchId', select: 'name batchCode' },
      { path: 'liveClassId', select: 'title' }
    ]
  });

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Increment view count
  await resourceRepository.incrementViewCount(id);

  res.json({
    success: true,
    data: resource
  });
});



/**
 * Get resource for preview (returns file as blob with metadata)
 */
const getResourceForPreview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userRole = req.user.roleId.name;

  // Get user's enrollments for access control
  let enrolledCourseIds = [];
  let enrolledBatchIds = [];

  if (userRole === 'STUDENT') {
    const enrollments = await enrollmentRepository.findByStudent(req.user.id);
    enrolledCourseIds = enrollments.map(e => e.courseId?.id?.toString()).filter(Boolean);
    enrolledBatchIds = enrollments.map(e => e.batchId?.id?.toString()).filter(Boolean);
  }

  // Check if user can access this resource
  const canAccess = await resourceRepository.canUserAccessResource(
    id, 
    req.user.id, 
    userRole, 
    enrolledCourseIds, 
    enrolledBatchIds
  );

  if (!canAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this resource'
    });
  }

  const resource = await resourceRepository.findById(id);
  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // For small files that can be previewed directly, return as blob
  // For large files, return metadata with signed URL or streaming info
  const filePath = path.join(__dirname, '../../uploads/resources/', resource.fileName);
  
  try {
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    // Determine if we should return the file content or just metadata
    const shouldReturnBlob = fileSize <= 10 * 1024 * 1024; // 10MB limit for blob response

    if (shouldReturnBlob) {
      // Read file as buffer
      const fileBuffer = await fs.readFile(filePath);
      
      // Set appropriate headers
      res.setHeader('Content-Type', resource.mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.originalName)}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      // Return both metadata and file content
      res.json({
        success: true,
        data: {
          metadata: {
            id: resource._id,
            title: resource.title,
            description: resource.description,
            originalName: resource.originalName,
            fileType: resource.fileType,
            mimeType: resource.mimeType,
            fileSize: resource.fileSize,
            uploadedAt: resource.uploadedAt,
            uploadedBy: resource.uploadedBy
          },
          fileData: fileBuffer.toString('base64'), // Convert to base64 for JSON response
          encoding: 'base64'
        }
      });
    } else {
      // For large files, return metadata with streaming information
      res.json({
        success: true,
        data: {
          metadata: {
            id: resource._id,
            title: resource.title,
            description: resource.description,
            originalName: resource.originalName,
            fileType: resource.fileType,
            mimeType: resource.mimeType,
            fileSize: resource.fileSize,
            uploadedAt: resource.uploadedAt,
            uploadedBy: resource.uploadedBy
          },
          streaming: {
            url: `/api/resources/${id}/stream`, // Endpoint for streaming the file
            supportsRange: true,
            method: 'GET'
          }
        }
      });
    }

    // Increment view count for preview
    await resourceRepository.incrementViewCount(id);

  } catch (error) {
    console.error('Preview error:', error);
    return res.status(404).json({
      success: false,
      message: 'File not found on server'
    });
  }
});

/**
 * Stream resource for preview (for large files)
 */
const streamResourceForPreview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userRole = req.user.roleId.name;

  // Get user's enrollments for access control
  let enrolledCourseIds = [];
  let enrolledBatchIds = [];

  if (userRole === 'STUDENT') {
    const enrollments = await enrollmentRepository.findByStudent(req.user.id);
    enrolledCourseIds = enrollments.map(e => e.courseId?.id?.toString()).filter(Boolean);
    enrolledBatchIds = enrollments.map(e => e.batchId?.id?.toString()).filter(Boolean);
  }

  // Check if user can access this resource
  const canAccess = await resourceRepository.canUserAccessResource(
    id, 
    req.user.id, 
    userRole, 
    enrolledCourseIds, 
    enrolledBatchIds
  );

  if (!canAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this resource'
    });
  }

  const resource = await resourceRepository.findById(id);
  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  const filePath = path.join(__dirname, '../../uploads/resources/', resource.fileName);
  
  try {
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    const range = req.headers.range;

    // Set headers for streaming
    res.setHeader('Content-Type', resource.mimeType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.originalName)}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Handle range requests for efficient streaming
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize,
      });

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(res);
    } else {
      // Full file stream
      res.writeHead(200);
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }

    // Increment view count
    await resourceRepository.incrementViewCount(id);

  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
  }
});

/**
 * Create new resource
 */
const createResource = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { title, description, resourceLevel, courseId, batchId, liveClassId, accessLevel, tags, expiresAt } = req.body;
  const userRole = req.user.roleId.name;

  // Check if user can create resources at this level
  if (userRole === 'STUDENT') {
    return res.status(403).json({
      success: false,
      message: 'Students cannot upload resources'
    });
  }

  // Validate file upload
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'File is required'
    });
  }

  const file = req.file;
  
  // Determine file type category
  const fileType = getFileTypeCategory(file.mimetype);

  // Create resource data
  const resourceData = {
    title,
    description,
    fileName: file.filename,
    originalName: file.originalname,
    fileType,
    mimeType: file.mimetype,
    fileSize: file.size,
    fileUrl: `/uploads/resources/${file.filename}`,
    resourceLevel: resourceLevel.toUpperCase(),
    accessLevel: accessLevel || 'ENROLLED_ONLY',
    uploadedBy: req.user.id,
    status: 'ACTIVE'
  };

  // Set appropriate ID based on resource level
  if (resourceLevel === 'COURSE' || resourceLevel === 'course') {
    resourceData.courseId = courseId;
    // Verify course exists and user has access
    const course = await courseRepository.findById(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }
  } else if (resourceLevel === 'BATCH' || resourceLevel === 'batch') {
    resourceData.batchId = batchId;
    // Verify batch exists and user has access
    const batch = await batchRepository.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }
  } else if (resourceLevel === 'CLASS' || resourceLevel === 'class') {
    resourceData.liveClassId = liveClassId;
  }

  // Add tags if provided
  if (tags) {
    resourceData.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
  }

  // Add expiry date if provided
  if (expiresAt) {
    resourceData.expiresAt = new Date(expiresAt);
  }

  const resource = await resourceRepository.create(resourceData);

  // Populate the response
  const populatedResource = await resourceRepository.findById(resource.id, {
    populate: [
      { path: 'uploadedBy', select: 'firstName lastName email' },
      { path: 'courseId', select: 'title' },
      { path: 'batchId', select: 'name batchCode' },
      { path: 'liveClassId', select: 'title' }
    ]
  });

  // Notify students enrolled in the relevant scope.
  let recipientIds = [];
  if (resourceData.resourceLevel === 'COURSE' && resourceData.courseId) {
    const enrollments = await enrollmentRepository.find(
      { courseId: resourceData.courseId, status: 'ENROLLED' },
      { select: 'studentId' }
    );
    recipientIds = enrollments.map((enrollment) => enrollment.studentId?.toString()).filter(Boolean);
  } else if (resourceData.resourceLevel === 'BATCH' && resourceData.batchId) {
    const enrollments = await enrollmentRepository.find(
      { batchId: resourceData.batchId, status: 'ENROLLED' },
      { select: 'studentId' }
    );
    recipientIds = enrollments.map((enrollment) => enrollment.studentId?.toString()).filter(Boolean);
  } else if (resourceData.resourceLevel === 'CLASS' && resourceData.liveClassId) {
    const liveClass = await LiveClass.findById(resourceData.liveClassId).select('batchId').lean();
    if (liveClass?.batchId) {
      const enrollments = await enrollmentRepository.find(
        { batchId: liveClass.batchId, status: 'ENROLLED' },
        { select: 'studentId' }
      );
      recipientIds = enrollments.map((enrollment) => enrollment.studentId?.toString()).filter(Boolean);
    }
  }

  await notificationService.createForUsers(recipientIds, {
    actorId: req.user.id,
    type: 'RESOURCE_ADDED',
    title: 'New learning resource',
    message: `${title} was added to your learning materials.`,
    priority: 'normal',
    data: {
      resourceId: resource.id || resource._id?.toString(),
      resourceLevel: resourceData.resourceLevel,
      courseId: resourceData.courseId || null,
      batchId: resourceData.batchId || null,
      liveClassId: resourceData.liveClassId || null
    }
  });

  res.status(201).json({
    success: true,
    message: 'Resource uploaded successfully',
    data: populatedResource
  });
});

/**
 * Update resource
 */
const updateResource = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const { title, description, accessLevel, tags, expiresAt } = req.body;
  const userRole = req.user.roleId.name;

  const resource = await resourceRepository.findById(id);
  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && resource.uploadedBy.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'You can only update your own resources'
    });
  }

  const updateData = {};
  if (title) updateData.title = title;
  if (description) updateData.description = description;
  if (accessLevel) updateData.accessLevel = accessLevel;
  if (tags) updateData.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
  if (expiresAt) updateData.expiresAt = new Date(expiresAt);

  const updatedResource = await resourceRepository.findByIdAndUpdate(id, updateData);

  res.json({
    success: true,
    message: 'Resource updated successfully',
    data: updatedResource
  });
});

/**
 * Delete resource
 */
const deleteResource = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;
  const userRole = req.user.roleId.name;

  const resource = await resourceRepository.findById(id);
  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && resource.uploadedBy.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'You can only delete your own resources'
    });
  }

  // Soft delete
  await resourceRepository.softDeleteResource(id);

  res.json({
    success: true,
    message: 'Resource deleted successfully'
  });
});

/**
 * Download resource
 */
const downloadResource = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userRole = req.user.roleId.name;

  // Get user's enrollments for access control
  let enrolledCourseIds = [];
  let enrolledBatchIds = [];

  if (userRole === 'STUDENT') {
    const enrollments = await enrollmentRepository.findByStudent(req.user.id);
    enrolledCourseIds = enrollments.map(e => { console.log(e.courseId, "Course Id of current enrollment");return e.courseId.id.toString() });
    enrolledBatchIds = enrollments.map(e => e.batchId.id.toString());
    console.log({enrolledCourseIds, enrolledBatchIds}, "Enrolled fcourses and batches")
  }

  // Check if user can access this resource
  const canAccess = await resourceRepository.canUserAccessResource(
    id, 
    req.user.id, 
    userRole, 
    enrolledCourseIds, 
    enrolledBatchIds
  );

  if (!canAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this resource'
    });
  }

  const resource = await resourceRepository.findById(id);
  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }
  console.log(resource, "Resource to be downloaded");

  // Increment download count
  await resourceRepository.incrementDownloadCount(id);

  // Send file
  const filePath = path.join(__dirname, '../../uploads/resources/', resource.fileName);
  
  try {
    await fs.access(filePath);
    console.log("Able to access file")
    res.download(filePath, resource.originalName);
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: 'File not found on server'
    });
  }
});

/**
 * Get resources by course
 */
const getResourcesByCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const userRole = req.user.roleId.name;

  const resources = await resourceRepository.findByCourse(courseId, userRole);

  res.json({
    success: true,
    data: resources
  });
});

/**
 * Get resources by batch
 */
const getResourcesByBatch = asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const userRole = req.user.roleId.name;

  const resources = await resourceRepository.findByBatch(batchId, userRole);

  res.json({
    success: true,
    data: resources
  });
});

/**
 * Get resource statistics
 */
const getResourceStats = asyncHandler(async (req, res) => {
  const { courseId, batchId } = req.query;
  const userRole = req.user.roleId.name;

  let filters = {};
  if (courseId) filters.courseId = courseId;
  if (batchId) filters.batchId = batchId;

  // For instructors, show only their resources
  if (userRole === 'INSTRUCTOR') {
    filters.uploadedBy = req.user.id;
  }

  const stats = await resourceRepository.getResourceStats(filters);

  res.json({
    success: true,
    data: stats
  });
});

/**
 * Archive resource
 */
const archiveResource = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userRole = req.user.roleId.name;

  const resource = await resourceRepository.findById(id);
  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Check permissions
  if (userRole !== 'ADMIN' && resource.uploadedBy.toString() !== req.user.id) {
    return res.status(403).json({
      success: false,
      message: 'You can only archive your own resources'
    });
  }

  await resourceRepository.archiveResource(id);

  res.json({
    success: true,
    message: 'Resource archived successfully'
  });
});



/**
 * PUBLIC RESOURCES CONTROLLERS
 */
/**
 * Get public resource by ID (no authentication required)
 */

const getAllPublicResources = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  // Find the resource
  const resource = await resourceRepository.find({accessLevel: "PUBLIC"}, {
    populate: [
      { path: 'uploadedBy', select: 'firstName lastName email' },
      { path: 'courseId', select: 'title' },
      { path: 'batchId', select: 'name batchCode' },
      { path: 'liveClassId', select: 'title' }
    ]
  });

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  res.json({
    success: true,
    data: resource
  });
});

const getPublicResource = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;

  // Find the resource
  const resource = await resourceRepository.findOne({_id: id}, {
    populate: [
      { path: 'uploadedBy', select: 'firstName lastName email' },
      { path: 'courseId', select: 'title' },
      { path: 'batchId', select: 'name batchCode' },
      { path: 'liveClassId', select: 'title' }
    ]
  });

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Check if resource is public
  if (resource.accessLevel !== 'PUBLIC') {
    return res.status(403).json({
      success: false,
      message: 'This resource is not publicly accessible'
    });
  }

  // Check if resource is expired
  if (resource.expiresAt && new Date(resource.expiresAt) < new Date()) {
    return res.status(410).json({
      success: false,
      message: 'This resource has expired'
    });
  }

  // Check if resource is active
  if (resource.status !== 'ACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'This resource is not available'
    });
  }

  // Increment view count
  await resourceRepository.incrementViewCount(id);

  res.json({
    success: true,
    data: resource
  });
});

/**
 * Download public resource (no authentication required)
 */
const downloadPublicResource = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { id } = req.params;

  // Find the resource
  const resource = await resourceRepository.findById(id);

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Check if resource is public
  if (resource.accessLevel !== 'PUBLIC') {
    return res.status(403).json({
      success: false,
      message: 'This resource is not publicly accessible'
    });
  }

  // Check if resource is expired
  if (resource.expiresAt && new Date(resource.expiresAt) < new Date()) {
    return res.status(410).json({
      success: false,
      message: 'This resource has expired'
    });
  }

  // Check if resource is active
  if (resource.status !== 'ACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'This resource is not available'
    });
  }

  // Increment download count
  await resourceRepository.incrementDownloadCount(id);

  // Send file
  const filePath = path.join(__dirname, '../../uploads/resources/', resource.fileName);
  
  try {
    await fs.access(filePath);
    res.download(filePath, resource.originalName);
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: 'File not found on server'
    });
  }
});

/**
 * Preview public resource (no authentication required)
 */
const previewPublicResource = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the resource
  const resource = await resourceRepository.findById(id);

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Check if resource is public
  if (resource.accessLevel !== 'PUBLIC') {
    return res.status(403).json({
      success: false,
      message: 'This resource is not publicly accessible'
    });
  }

  // Check if resource is expired
  if (resource.expiresAt && new Date(resource.expiresAt) < new Date()) {
    return res.status(410).json({
      success: false,
      message: 'This resource has expired'
    });
  }

  // Check if resource is active
  if (resource.status !== 'ACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'This resource is not available'
    });
  }

  // For small files that can be previewed directly, return as blob
  const filePath = path.join(__dirname, '../../uploads/resources/', resource.fileName);
  
  try {
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    // Determine if we should return the file content or just metadata
    const shouldReturnBlob = fileSize <= 10 * 1024 * 1024; // 10MB limit for blob response

    if (shouldReturnBlob) {
      // Read file as buffer
      const fileBuffer = await fs.readFile(filePath);
      
      // Set appropriate headers
      res.setHeader('Content-Type', resource.mimeType);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.originalName)}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      
      // Return both metadata and file content
      res.json({
        success: true,
        data: {
          metadata: {
            id: resource._id,
            title: resource.title,
            description: resource.description,
            originalName: resource.originalName,
            fileType: resource.fileType,
            mimeType: resource.mimeType,
            fileSize: resource.fileSize,
            uploadedAt: resource.uploadedAt,
            uploadedBy: resource.uploadedBy
          },
          fileData: fileBuffer.toString('base64'), // Convert to base64 for JSON response
          encoding: 'base64'
        }
      });
    } else {
      // For large files, return metadata with streaming information
      res.json({
        success: true,
        data: {
          metadata: {
            id: resource._id,
            title: resource.title,
            description: resource.description,
            originalName: resource.originalName,
            fileType: resource.fileType,
            mimeType: resource.mimeType,
            fileSize: resource.fileSize,
            uploadedAt: resource.uploadedAt,
            uploadedBy: resource.uploadedBy
          },
          streaming: {
            url: `/api/resources/public/${id}/stream`, // Endpoint for streaming the file
            supportsRange: true,
            method: 'GET'
          }
        }
      });
    }

    // Increment view count for preview
    await resourceRepository.incrementViewCount(id);

  } catch (error) {
    console.error('Preview error:', error);
    return res.status(404).json({
      success: false,
      message: 'File not found on server'
    });
  }
});

/**
 * Stream public resource for preview (for large files, no authentication required)
 */
const streamPublicResource = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find the resource
  const resource = await resourceRepository.findById(id);

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found'
    });
  }

  // Check if resource is public
  if (resource.accessLevel !== 'PUBLIC') {
    return res.status(403).json({
      success: false,
      message: 'This resource is not publicly accessible'
    });
  }

  // Check if resource is expired
  if (resource.expiresAt && new Date(resource.expiresAt) < new Date()) {
    return res.status(410).json({
      success: false,
      message: 'This resource has expired'
    });
  }

  // Check if resource is active
  if (resource.status !== 'ACTIVE') {
    return res.status(403).json({
      success: false,
      message: 'This resource is not available'
    });
  }

  const filePath = path.join(__dirname, '../../uploads/resources/', resource.fileName);
  
  try {
    await fs.access(filePath);
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    const range = req.headers.range;

    // Set headers for streaming
    res.setHeader('Content-Type', resource.mimeType);
    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.originalName)}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    // Handle range requests for efficient streaming
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Content-Length': chunksize,
      });

      const fileStream = fs.createReadStream(filePath, { start, end });
      fileStream.pipe(res);
    } else {
      // Full file stream
      res.writeHead(200);
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }

    // Increment view count
    await resourceRepository.incrementViewCount(id);

  } catch (error) {
    console.error('Stream error:', error);
    if (!res.headersSent) {
      res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }
  }
});


/**
 * Helper function to determine file type category
 */
function getFileTypeCategory(mimeType) {
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('video')) return 'VIDEO';
  if (mimeType.includes('audio')) return 'AUDIO';
  if (mimeType.includes('image')) return 'IMAGE';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PRESENTATION';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'SPREADSHEET';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOCUMENT';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'ARCHIVE';
  return 'OTHER';
}

/**
 * Configure multer for file uploads
 */
const configureMulter = () => {
  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      const uploadPath = path.join(__dirname, '../../uploads/resources');
      try {
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'resource-' + uniqueSuffix + ext);
    }
  });

  const fileFilter = (req, file, cb) => {
    // Define allowed file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar|mp4|mp3|avi|mov/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only specific file types are allowed!'));
    }
  };

  return multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: fileFilter
  });
};

const upload = configureMulter();

module.exports = {
  getResources,
  getResource,
  getResourceForPreview,
  streamResourceForPreview,
  createResource,
  updateResource,
  deleteResource,
  downloadResource,
  getResourcesByCourse,
  getResourcesByBatch,
  getResourceStats,
  archiveResource,
  getPublicResource,
  downloadPublicResource,
  previewPublicResource,
  streamPublicResource,
  getAllPublicResources,
  upload
};
