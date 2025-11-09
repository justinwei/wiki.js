const express = require('express')
const router = express.Router()
const _ = require('lodash')
const multer = require('multer')
const path = require('path')
const fs = require('fs-extra')

/* global WIKI */

const upload = multer({
  dest: path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'temp'),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 1
  }
}).single('importFile')

/**
 * Import markdown files (async)
 */
router.post('/markdown', (req, res, next) => {
  upload(req, res, err => {
    if (err) {
      return next(err)
    }
    next()
  })
}, async (req, res) => {
  if (!_.some(req.user.permissions, pm => _.includes(['write:pages', 'manage:pages', 'manage:system'], pm))) {
    return res.status(403).json({
      succeeded: false,
      message: 'You are not authorized to import files.'
    })
  }

  if (!req.file) {
    return res.status(400).json({
      succeeded: false,
      message: 'No file uploaded.'
    })
  }

  const locale = req.body.locale || WIKI.config.lang.code || 'zh'
  const targetPath = req.body.targetPath || ''
  const parsedParentId = req.body.parentId ? parseInt(req.body.parentId, 10) : null
  const parentId = Number.isNaN(parsedParentId) ? null : parsedParentId

  try {
    WIKI.logger.info(`[Import Controller] Queueing import for file: ${req.file.originalname}`)
    const task = await WIKI.models.importTasks.createTask({
      userId: req.user.id,
      originalName: req.file.originalname,
      uploadPath: req.file.path,
      targetPath,
      locale,
      parentId
    })

    try {
      WIKI.scheduler.registerJob({
        name: 'import-markdown',
        immediate: true,
        worker: true
      }, task.id)
    } catch (jobErr) {
      WIKI.logger.error(`[Import Controller] Failed to schedule import task ${task.id}: ${jobErr.message}`)
      await WIKI.models.importTasks.updateTask(task.id, {
        status: 'failed',
        message: jobErr.message,
        errors: [{
          file: req.file.originalname,
          error: jobErr.message
        }],
        completedAt: new Date().toISOString()
      })
      await fs.remove(task.uploadPath).catch(() => {})
      return res.status(500).json({
        succeeded: false,
        message: 'Failed to schedule import task.'
      })
    }

    return res.json({
      succeeded: true,
      taskId: task.id,
      status: task.status,
      message: 'Import task has been queued.'
    })
  } catch (err) {
    WIKI.logger.error(`[Import Controller] Failed to queue import: ${err.message}`)
    WIKI.logger.error(err)
    await fs.remove(req.file.path).catch(() => {})
    return res.status(500).json({
      succeeded: false,
      message: err.message
    })
  }
})

/**
 * Retrieve import task status
 */
router.get('/status/:taskId', async (req, res) => {
  if (!_.some(req.user.permissions, pm => _.includes(['write:pages', 'manage:pages', 'manage:system'], pm))) {
    return res.status(403).json({
      succeeded: false,
      message: 'You are not authorized to view import status.'
    })
  }

  const taskId = parseInt(req.params.taskId, 10)
  if (Number.isNaN(taskId)) {
    return res.status(400).json({
      succeeded: false,
      message: 'Invalid task identifier.'
    })
  }

  try {
    const task = await WIKI.models.importTasks.getTaskForUser(taskId, req.user.id)
    if (!task) {
      return res.status(404).json({
        succeeded: false,
        message: 'Import task not found.'
      })
    }

    return res.json({
      succeeded: true,
      taskId: task.id,
      status: task.status,
      message: task.message,
      total: task.total,
      created: task.created,
      updated: task.updated,
      failed: task.failed,
      errors: task.errors || [],
      processed: task.processed || 0,
      currentFile: task.currentFile || '',
      progress: task.progress || [],
      originalName: task.originalName,
      completedAt: task.completedAt
    })
  } catch (err) {
    WIKI.logger.error(`[Import Controller] Failed to fetch status for task ${taskId}: ${err.message}`)
    return res.status(500).json({
      succeeded: false,
      message: err.message
    })
  }
})

module.exports = router
