const fs = require('fs-extra')
const { EventEmitter2 } = require('eventemitter2')

/* global WIKI */

const importModule = require('../modules/import/markdown')

module.exports = async (payload) => {
  const taskId = extractTaskId(payload)
  WIKI.logger.info(`[Import Job] Starting task ${taskId}`)

  let task

  try {
    WIKI.models = require('../core/db').init()
    await WIKI.configSvc.loadFromDb()
    await WIKI.configSvc.applyFlags()

    if (!WIKI.data) {
      WIKI.data = {}
    }

    if (!WIKI.lang) {
      WIKI.lang = require('../core/localization').init()
    }
    if (!WIKI.auth) {
      WIKI.auth = require('../core/auth').init()
      await WIKI.auth.reloadGroups()
    }

    if (!WIKI.scheduler) {
      WIKI.scheduler = require('../core/scheduler').init()
    }

    if (!WIKI.events) {
      WIKI.events = {
        inbound: new EventEmitter2(),
        outbound: new EventEmitter2()
      }
    }

    if (!WIKI.data.searchEngine) {
      WIKI.data.searchEngine = {
        async created() {},
        async updated() {},
        async renamed() {},
        async deleted() {}
      }
    }

    if (!WIKI.data.editors || WIKI.data.editors.length === 0) {
      await WIKI.models.editors.refreshEditorsFromDisk()
    }

    task = await WIKI.models.importTasks.getTaskById(taskId)
    if (!task) {
      throw new Error(`Import task ${taskId} not found`)
    }

    await WIKI.models.importTasks.updateTask(taskId, {
      status: 'processing',
      message: '正在导入内容...'
    })

    const user = await WIKI.models.users.query()
      .findById(task.userId)
      .withGraphJoined('groups')
      .modifyGraph('groups', builder => {
        builder.select('groups.id', 'permissions')
      })
    if (!user) {
      throw new Error(`User ${task.userId} not found for import task ${taskId}`)
    }
    user.permissions = user.getGlobalPermissions()
    user.groups = user.groups || []

    const progressLog = Array.isArray(task.progress) ? task.progress : []

    const results = await importModule.importFiles({
      uploadPath: task.uploadPath,
      originalName: task.originalName,
      targetPath: task.targetPath,
      locale: task.locale,
      parentId: task.parentId,
      user,
      onProgress: async ({ total, index, stage, file, title, error }) => {
        if (!file && title) {
          file = title
        }

        if (!progressLog[index]) {
          progressLog[index] = {
            file: file || title || '',
            title: title || file || '',
            status: 'pending',
            error: null
          }
        }

        const entry = progressLog[index]

        if (stage === 'start') {
          entry.status = 'processing'
          entry.error = null
          entry.file = file || entry.file
          entry.title = title || entry.title || entry.file
          await WIKI.models.importTasks.updateTask(taskId, {
            total,
            processed: index,
            currentFile: entry.file,
            message: `正在导入：${entry.file}`,
            progress: progressLog
          })
          return
        }

        if (stage === 'success') {
          entry.status = 'success'
          entry.error = null
          entry.file = file || entry.file
          entry.title = title || entry.title || entry.file
          await WIKI.models.importTasks.updateTask(taskId, {
            total,
            processed: index + 1,
            currentFile: entry.file,
            message: `已导入：${entry.file}`,
            progress: progressLog
          })
          return
        }

        if (stage === 'failed') {
          entry.status = 'failed'
          entry.error = error || null
          entry.file = file || entry.file
          entry.title = title || entry.title || entry.file
        await WIKI.models.importTasks.updateTask(taskId, {
            total,
            processed: index + 1,
            currentFile: entry.file,
            message: `导入失败：${entry.file}`,
            progress: progressLog
          })
          return
        }
      }
    })

    const completionMessage = results.message || `Import completed. Created: ${results.created}, Updated: ${results.updated}, Failed: ${results.failed}`

    await WIKI.models.importTasks.updateTask(taskId, {
      status: 'success',
      total: results.total,
      created: results.created,
      updated: results.updated,
      failed: results.failed,
      errors: results.errors || [],
      processed: results.total,
      currentFile: '',
      progress: progressLog,
      message: completionMessage,
      completedAt: new Date().toISOString()
    })

    await cleanupUpload(task?.uploadPath)
    WIKI.logger.info(`[Import Job] Task ${taskId} completed successfully.`)
  } catch (err) {
    WIKI.logger.error(`[Import Job] Task ${taskId} failed: ${err.message}`)
    try {
      if (!task && WIKI.models) {
        task = await WIKI.models.importTasks.getTaskById(taskId)
      }
      const errors = task && Array.isArray(task.errors) ? task.errors : []
      errors.push({
        file: task?.originalName || 'unknown',
        error: err.message
      })
      if (WIKI.models && WIKI.models.importTasks) {
        await WIKI.models.importTasks.updateTask(taskId, {
          status: 'failed',
          message: err.message,
          errors,
          progress: progressLog,
          completedAt: new Date().toISOString()
        })
      }
    } catch (updateErr) {
      WIKI.logger.error(`[Import Job] Failed to update task ${taskId} after error: ${updateErr.message}`)
    } finally {
      await cleanupUpload(task?.uploadPath)
    }

    if (WIKI.models && WIKI.models.knex) {
      await WIKI.models.knex.destroy()
    }

    throw err
  }

  if (WIKI.models && WIKI.models.knex) {
    await WIKI.models.knex.destroy()
  }
}

function extractTaskId(payload) {
  if (payload == null) {
    throw new Error('Import job payload is empty')
  }

  if (typeof payload === 'object' && payload.taskId) {
    return parseInt(payload.taskId, 10)
  }

  const id = parseInt(payload, 10)
  if (Number.isNaN(id)) {
    throw new Error(`Invalid import task payload: ${JSON.stringify(payload)}`)
  }
  return id
}

async function cleanupUpload(uploadPath) {
  if (!uploadPath) {
    return
  }
  try {
    await fs.remove(uploadPath)
  } catch (err) {
    WIKI.logger.warn(`[Import Job] Failed to clean up upload ${uploadPath}: ${err.message}`)
  }
}

