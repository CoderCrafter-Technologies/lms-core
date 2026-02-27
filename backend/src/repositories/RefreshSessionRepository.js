const BaseRepository = require('./BaseRepository');
const RefreshSession = require('../models/RefreshSession');

class RefreshSessionRepository extends BaseRepository {
  constructor() {
    super(RefreshSession);
  }

  async findActiveBySessionId(sessionId) {
    return await this.findOne({
      sessionId,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    });
  }

  async findActiveByUser(userId) {
    return await this.find({
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() }
    }, {
      sort: { lastUsedAt: -1 }
    });
  }

  async revokeBySessionId(sessionId, reason = 'manual') {
    return await this.model.findOneAndUpdate(
      { sessionId, revokedAt: null },
      { revokedAt: new Date(), revokedReason: reason },
      { new: true }
    );
  }

  async revokeAllForUser(userId, reason = 'revoke-all', exceptSessionId = null) {
    const criteria = {
      userId,
      revokedAt: null
    };

    if (exceptSessionId) {
      criteria.sessionId = { $ne: exceptSessionId };
    }

    return await this.updateMany(criteria, {
      revokedAt: new Date(),
      revokedReason: reason
    });
  }
}

module.exports = RefreshSessionRepository;
