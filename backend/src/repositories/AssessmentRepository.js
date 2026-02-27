const BaseRepository = require('./BaseRepository');
const { Assessment } = require('../models');

class AssessmentRepository extends BaseRepository {
  constructor() {
    super(Assessment);
  }

  async findByCourse(courseId, options = {}) {
    const defaultOptions = {
      populate: [
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'courseId', select: 'title' },
        { path: 'batchId', select: 'name batchCode' }
      ]
    };
    
    return this.find({ courseId, status: { $ne: 'deleted' } }, { ...defaultOptions, ...options });
  }

  async findByBatch(batchId, options = {}) {
    const defaultOptions = {
      populate: [
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'courseId', select: 'title' },
        { path: 'batchId', select: 'name batchCode' }
      ]
    };
    
    return this.find({ 
      $or: [
        { batchId },
        { batchId: null } // Include course-wide assessments
      ],
      status: 'published'
    }, { ...defaultOptions, ...options });
  }

  async findAvailableForStudent(studentId, courseId, batchId = null) {
    const now = new Date();
    const scheduleConditions = [
      { 'schedule.isScheduled': false },
      {
        'schedule.isScheduled': true,
        'schedule.startDate': { $lte: now },
        'schedule.endDate': { $gte: now }
      }
    ];

    const query = {
      courseId,
      status: 'published',
      $and: [{ $or: scheduleConditions }]
    };

    if (batchId) {
      query.$and.push({
        $or: [
          { batchId },
          { batchId: null }
        ]
      });
    }

    return this.find(query, {
      populate: [
        { path: 'createdBy', select: 'firstName lastName' },
        { path: 'courseId', select: 'title' },
        { path: 'batchId', select: 'name batchCode' }
      ],
      sort: { 'schedule.startDate': 1, createdAt: 1 }
    });
  }

  async findWithStats(filters = {}, options = {}) {
    const pipeline = [
      { $match: { ...filters, status: { $ne: 'deleted' } } },
      {
        $lookup: {
          from: 'assessmentsubmissions',
          localField: '_id',
          foreignField: 'assessmentId',
          as: 'submissions'
        }
      },
      {
        $addFields: {
          totalSubmissions: { $size: '$submissions' },
          completedSubmissions: {
            $size: {
              $filter: {
                input: '$submissions',
                as: 'submission',
                cond: { $eq: ['$$submission.isCompleted', true] }
              }
            }
          },
          averageScore: {
            $avg: {
              $map: {
                input: {
                  $filter: {
                    input: '$submissions',
                    as: 'submission',
                    cond: { $eq: ['$$submission.isCompleted', true] }
                  }
                },
                as: 'submission',
                in: '$$submission.scoring.percentage'
              }
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator'
        }
      },
      {
        $addFields: {
          createdBy: { $arrayElemAt: ['$creator', 0] }
        }
      }
    ];

    if (options.sort) {
      pipeline.push({ $sort: options.sort });
    }

    if (options.skip) {
      pipeline.push({ $skip: options.skip });
    }

    if (options.limit) {
      pipeline.push({ $limit: options.limit });
    }

    return this.model.aggregate(pipeline);
  }

  async getAssessmentStats(assessmentId) {
    const pipeline = [
      { $match: { _id: this.toObjectId(assessmentId) } },
      {
        $lookup: {
          from: 'assessmentsubmissions',
          localField: '_id',
          foreignField: 'assessmentId',
          as: 'submissions'
        }
      },
      {
        $project: {
          title: 1,
          totalQuestions: { $size: '$questions' },
          totalSubmissions: { $size: '$submissions' },
          completedSubmissions: {
            $size: {
              $filter: {
                input: '$submissions',
                as: 'submission',
                cond: { $eq: ['$$submission.isCompleted', true] }
              }
            }
          },
          averageScore: {
            $avg: {
              $map: {
                input: {
                  $filter: {
                    input: '$submissions',
                    as: 'submission',
                    cond: { $eq: ['$$submission.isCompleted', true] }
                  }
                },
                as: 'submission',
                in: '$$submission.scoring.percentage'
              }
            }
          },
          passRate: {
            $multiply: [
              {
                $divide: [
                  {
                    $size: {
                      $filter: {
                        input: '$submissions',
                        as: 'submission',
                        cond: {
                          $and: [
                            { $eq: ['$$submission.isCompleted', true] },
                            { $eq: ['$$submission.scoring.isPassed', true] }
                          ]
                        }
                      }
                    }
                  },
                  {
                    $max: [
                      {
                        $size: {
                          $filter: {
                            input: '$submissions',
                            as: 'submission',
                            cond: { $eq: ['$$submission.isCompleted', true] }
                          }
                        }
                      },
                      1
                    ]
                  }
                ]
              },
              100
            ]
          },
          gradeDistribution: {
            $arrayToObject: {
              $map: {
                input: ['A', 'B', 'C', 'D', 'F'],
                as: 'grade',
                in: {
                  k: '$$grade',
                  v: {
                    $size: {
                      $filter: {
                        input: '$submissions',
                        as: 'submission',
                        cond: {
                          $and: [
                            { $eq: ['$$submission.isCompleted', true] },
                            { $eq: ['$$submission.scoring.grade', '$$grade'] }
                          ]
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    ];

    const result = await this.model.aggregate(pipeline);
    return result[0] || null;
  }

  async updateStats(assessmentId) {
    const stats = await this.getAssessmentStats(assessmentId);
    if (stats) {
      await this.updateById(assessmentId, {
        'stats.totalAttempts': stats.totalSubmissions,
        'stats.averageScore': Math.round(stats.averageScore || 0),
        'stats.passRate': Math.round(stats.passRate || 0),
        'stats.completionRate': Math.round(
          stats.totalSubmissions > 0 ? (stats.completedSubmissions / stats.totalSubmissions) * 100 : 0
        )
      });
    }
  }

  async duplicate(assessmentId, newTitle, createdBy) {
    const original = await this.findById(assessmentId);
    if (!original) {
      throw new Error('Assessment not found');
    }

    const duplicated = new this.model({
      ...original.toObject(),
      _id: undefined,
      title: newTitle,
      status: 'draft',
      createdBy,
      lastModifiedBy: createdBy,
      publishedAt: null,
      stats: {
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        completionRate: 0
      }
    });

    return duplicated.save();
  }
}

module.exports = AssessmentRepository;
