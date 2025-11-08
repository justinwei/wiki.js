const _ = require('lodash')

/* global WIKI */

module.exports = async (pageId) => {
  WIKI.logger.info(`Rebuilding page tree...`)

  try {
    WIKI.models = require('../core/db').init()
    await WIKI.configSvc.loadFromDb()
    await WIKI.configSvc.applyFlags()

    const pages = await WIKI.models.pages.query().select('id', 'path', 'localeCode', 'title', 'isPrivate', 'privateNS').orderBy(['localeCode', 'path'])
    const previousOrdersRaw = await WIKI.models.knex('pageTree').select('path', 'localeCode', 'sortOrder')
    const previousOrders = new Map()
    previousOrdersRaw.forEach(entry => {
      if (_.isNumber(entry.sortOrder)) {
        previousOrders.set(`${entry.localeCode || ''}:${entry.path}`, entry.sortOrder)
      }
    })
    let tree = []
    let pik = 0

    for (const page of pages) {
      const pagePaths = page.path.split('/')
      let currentPath = ''
      let depth = 0
      let parentId = null
      let ancestors = []
      for (const part of pagePaths) {
        depth++
        const isFolder = (depth < pagePaths.length)
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const found = _.find(tree, {
          localeCode: page.localeCode,
          path: currentPath
        })
        if (!found) {
          pik++
          const orderKey = `${page.localeCode || ''}:${currentPath}`
          const storedOrder = previousOrders.get(orderKey)
          tree.push({
            id: pik,
            localeCode: page.localeCode,
            path: currentPath,
            depth: depth,
            title: isFolder ? part : page.title,
            isFolder: isFolder,
            isPrivate: !isFolder && page.isPrivate,
            privateNS: !isFolder ? page.privateNS : null,
            parent: parentId,
            pageId: isFolder ? null : page.id,
            ancestors: JSON.stringify(ancestors),
            sortOrder: _.isNumber(storedOrder) ? storedOrder : null
          })
          parentId = pik
        } else if (isFolder && !found.isFolder) {
          found.isFolder = true
          parentId = found.id
        } else {
          parentId = found.id
        }
        ancestors.push(parentId)
      }
    }

    const siblingsByParent = _.groupBy(tree, node => `${node.localeCode || ''}:${node.parent || 0}`)
    _.forEach(siblingsByParent, siblings => {
      const manual = _.orderBy(siblings.filter(sib => _.isNumber(sib.sortOrder)), ['sortOrder'], ['asc'])
      const auto = _.orderBy(siblings.filter(sib => !_.isNumber(sib.sortOrder)), ['isFolder', 'title'], ['desc', 'asc'])
      const orderedGroup = [...manual, ...auto]
      orderedGroup.forEach((node, idx) => {
        node.sortOrder = idx + 1
      })
    })

    await WIKI.models.knex.table('pageTree').truncate()
    if (tree.length > 0) {
      // -> Save in chunks, because of per query max parameters (35k Postgres, 2k MSSQL, 1k for SQLite)
      if ((WIKI.config.db.type !== 'sqlite')) {
        for (const chunk of _.chunk(tree, 100)) {
          await WIKI.models.knex.table('pageTree').insert(chunk)
        }
      } else {
        for (const chunk of _.chunk(tree, 60)) {
          await WIKI.models.knex.table('pageTree').insert(chunk)
        }
      }
    }

    await WIKI.models.knex.destroy()

    WIKI.logger.info(`Rebuilding page tree: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Rebuilding page tree: [ FAILED ]`)
    WIKI.logger.error(err.message)
    // exit process with error code
    throw err
  }
}
