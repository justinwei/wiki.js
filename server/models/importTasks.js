const { Model } = require('objection')

/**
 * Import Tasks model
 */
module.exports = class ImportTask extends Model {
  static get tableName() {
    return 'importTasks'
  }

  static get jsonAttributes() {
    return ['errors', 'progress']
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['status', 'locale', 'userId', 'originalName', 'uploadPath'],
      properties: {
        id: { type: 'integer' },
        status: { type: 'string' },
        targetPath: { type: 'string' },
        locale: { type: 'string' },
        userId: { type: 'integer' },
        originalName: { type: 'string' },
        uploadPath: { type: 'string' },
        parentId: { type: ['integer', 'null'] },
        total: { type: 'integer' },
        created: { type: 'integer' },
        updated: { type: 'integer' },
        failed: { type: 'integer' },
        processed: { type: 'integer' },
        currentFile: { type: 'string' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              error: { type: 'string' }
            }
          }
        },
        progress: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'string' },
              error: { type: ['string', 'null'] }
            }
          }
        },
        message: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        completedAt: { type: ['string', 'null'] }
      }
    }
  }

  $beforeInsert() {
    const now = new Date().toISOString()
    this.createdAt = now
    this.updatedAt = now
    if (!this.status) {
      this.status = 'queued'
    }
    if (!this.message) {
      this.message = ''
    }
    if (!this.errors) {
      this.errors = []
    }
    if (!this.progress) {
      this.progress = []
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
    if (!this.errors) {
      this.errors = []
    }
    if (!this.progress) {
      this.progress = []
    }
  }

  static async createTask({ userId, originalName, uploadPath, targetPath = '', locale, parentId = null, message = '' }) {
    const payload = {
      status: 'queued',
      targetPath,
      locale,
      userId,
      originalName,
      uploadPath,
      parentId,
      message,
      total: 0,
      created: 0,
      updated: 0,
      failed: 0,
      processed: 0,
      currentFile: '',
      errors: [],
      progress: []
    }
    return this.query().insertAndFetch(payload)
  }

  static async updateTask(taskId, patch) {
    const updates = { ...patch }
    if (updates.errors && !Array.isArray(updates.errors)) {
      updates.errors = [].concat(updates.errors)
    }
    if (updates.progress && !Array.isArray(updates.progress)) {
      updates.progress = [].concat(updates.progress)
    }
    await this.query().patch(updates).where('id', taskId)
    return this.getTaskById(taskId)
  }

  static async markCompleted(taskId, fields = {}) {
    return this.updateTask(taskId, {
      status: 'success',
      completedAt: new Date().toISOString(),
      ...fields
    })
  }

  static async markFailed(taskId, { message, errors = [] }) {
    return this.updateTask(taskId, {
      status: 'failed',
      message: message || '',
      errors,
      completedAt: new Date().toISOString()
    })
  }

  static getTaskById(taskId) {
    return this.query().findById(taskId)
  }

  static getTaskForUser(taskId, userId) {
    return this.query().findOne({ id: taskId, userId })
  }
}

