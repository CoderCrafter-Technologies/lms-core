/**
 * Base Repository - Abstract database operations for PostgreSQL migration compatibility
 * This pattern isolates database logic and makes migration easier
 */
const mongoose = require('mongoose');
const { captureEvent } = require('../services/monitoringService');

class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  /**
   * Create a new document
   * @param {Object} data - Document data
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Created document
   */
  async create(data, options = {}) {
    try {
      const document = new this.model(data);
      const saved = await document.save(options);
      this._captureDataEvent('CREATE', saved, {
        model: this.model.modelName
      });
      return this._formatDocument(saved);
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Find document by ID
   * @param {String} id - Document ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Found document or null
   */
  async findById(id, options = {}) {
    try {
      const query = this.model.findById(id);
      
      if (options.populate) {
        query.populate(options.populate);
      }
      
      if (options.select) {
        query.select(options.select);
      }
      
      if (options.lean) {
        query.lean();
      }
      
      const document = await query.exec();
      return document ? this._formatDocument(document) : null;
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Find documents by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of documents
   */
  async find(criteria = {}, options = {}) {
    try {
      const query = this.model.find(criteria);
      
      if (options.populate) {
        query.populate(options.populate);
      }
      
      if (options.select) {
        query.select(options.select);
      }
      
      if (options.sort) {
        query.sort(options.sort);
      }
      
      if (options.limit) {
        query.limit(options.limit);
      }
      
      if (options.skip) {
        query.skip(options.skip);
      }
      
      if (options.lean) {
        query.lean();
      }
      
      const documents = await query.exec();
      return documents.map(doc => this._formatDocument(doc));
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Find one document by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Found document or null
   */
  async findOne(criteria, options = {}) {
    try {
      const query = this.model.findOne(criteria);
      
      if (options.populate) {
        query.populate(options.populate);
      }
      
      if (options.select) {
        query.select(options.select);
      }
      
      if (options.lean) {
        query.lean();
      }
      
      const document = await query.exec();
      return document ? this._formatDocument(document) : null;
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Update document by ID
   * @param {String} id - Document ID
   * @param {Object} updates - Update data
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} Updated document or null
   */
  async updateById(id, updates, options = {}) {
    try {
      const defaultOptions = {
        new: true,
        runValidators: true,
        ...options
      };
      // updates.courseId = updates.courseId.id;
      // updates.createdBy = updates.createdBy.id;
      const document = await this.model.findByIdAndUpdate(id, updates, defaultOptions);
      this._captureDataEvent('UPDATE', document, {
        model: this.model.modelName,
        updatedFields: Object.keys(updates || {})
      });
      return document ? this._formatDocument(document) : null;
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Update documents by criteria
   * @param {Object} criteria - Search criteria
   * @param {Object} updates - Update data
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Update result
   */
  async updateMany(criteria, updates, options = {}) {
    try {
      const result = await this.model.updateMany(criteria, updates, options);
      this._captureDataEvent('UPDATE_MANY', null, {
        model: this.model.modelName,
        criteria,
        updatedFields: Object.keys(updates || {}),
        modifiedCount: result.modifiedCount || 0
      });
      return {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        acknowledged: result.acknowledged
      };
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Delete document by ID
   * @param {String} id - Document ID
   * @returns {Promise<Object|null>} Deleted document or null
   */
  async deleteById(id) {
    try {
      const document = await this.model.findByIdAndDelete(id);
      this._captureDataEvent('DELETE', document, {
        model: this.model.modelName
      });
      return document ? this._formatDocument(document) : null;
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Delete documents by criteria
   * @param {Object} criteria - Delete criteria
   * @returns {Promise<Object>} Delete result
   */
  async deleteMany(criteria) {
    try {
      const result = await this.model.deleteMany(criteria);
      this._captureDataEvent('DELETE_MANY', null, {
        model: this.model.modelName,
        criteria,
        deletedCount: result.deletedCount || 0
      });
      return {
        deletedCount: result.deletedCount,
        acknowledged: result.acknowledged
      };
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Count documents by criteria
   * @param {Object} criteria - Count criteria
   * @returns {Promise<Number>} Document count
   */
  async count(criteria = {}) {
    try {
      return await this.model.countDocuments(criteria);
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Check if document exists
   * @param {Object} criteria - Search criteria
   * @returns {Promise<Boolean>} True if exists
   */
  async exists(criteria) {
    try {
      const document = await this.model.findOne(criteria).select('_id').lean();
      return !!document;
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Paginate documents
   * @param {Object} criteria - Search criteria
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} Paginated result
   */
  async paginate(criteria = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = { createdAt: -1 },
        populate,
        select
      } = options;

      const skip = (page - 1) * limit;
      
      const query = this.model.find(criteria);
      
      if (populate) query.populate(populate);
      if (select) query.select(select);
      
      query.sort(sort).skip(skip).limit(limit).lean();
      
      const [documents, total] = await Promise.all([
        query.exec(),
        this.count(criteria)
      ]);

      const totalPages = Math.ceil(total / limit);
      const hasNext = page < totalPages;
      const hasPrev = page > 1;

      return {
        documents: documents.map(doc => this._formatDocument(doc)),
        pagination: {
          current: page,
          limit,
          total,
          totalPages,
          hasNext,
          hasPrev
        }
      };
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Perform aggregation
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>} Aggregation result
   */
  async aggregate(pipeline) {
    try {
      const result = await this.model.aggregate(pipeline);
      return result;
    } catch (error) {
      throw this._formatError(error);
    }
  }

  /**
   * Execute with transaction
   * @param {Function} callback - Transaction callback
   * @returns {Promise<*>} Transaction result
   */
  async withTransaction(callback) {
    const session = await this.model.db.startSession();
    try {
      return await session.withTransaction(callback);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Format document for consistent response
   * @private
   * @param {Object} document - MongoDB document
   * @returns {Object} Formatted document
   */
  _formatDocument(document) {
    if (!document) return null;
    
    // If it's a lean query result or plain object
    if (document.constructor === Object) {
      const formatted = { ...document };
      if (formatted._id) {
        formatted.id = formatted._id;
        delete formatted._id;
      }
      delete formatted.__v;
      return formatted;
    }
    
    // If it's a Mongoose document
    return document.toJSON ? document.toJSON() : document;
  }

  /**
   * Format error for consistent error handling
   * @private
   * @param {Error} error - Original error
   * @returns {Error} Formatted error
   */
  _formatError(error) {
    // MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return new Error(`${field} already exists`);
    }
    
    // Validation error
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return new Error(messages.join(', '));
    }
    
    // Cast error (invalid ObjectId, etc.)
    if (error.name === 'CastError') {
      return new Error(`Invalid ${error.path}: ${error.value}`);
    }
    
    return error;
  }

  /**
   * Convert string/ObjectId to Mongo ObjectId for aggregation pipelines.
   * @param {string|Object} value
   * @returns {Object}
   */
  toObjectId(value) {
    if (!value) throw new Error('ObjectId value is required');
    if (value instanceof mongoose.Types.ObjectId) return value;
    if (typeof value === 'object' && value._id) {
      return this.toObjectId(value._id);
    }
    if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
      return new mongoose.Types.ObjectId(value);
    }
    throw new Error(`Invalid ObjectId: ${value}`);
  }

  _captureDataEvent(action, document, metadata = {}) {
    if (this.model?.modelName === 'MonitoringRecord') {
      return;
    }

    const entityId = document?._id?.toString?.() || document?.id?.toString?.() || '';
    const entityType = this.model?.modelName || 'UNKNOWN';

    captureEvent({
      source: 'REPOSITORY',
      action,
      entityType,
      entityId,
      message: `${entityType} ${action.toLowerCase()}`,
      metadata
    });
  }
}

module.exports = BaseRepository;
