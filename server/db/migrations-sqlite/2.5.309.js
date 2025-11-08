const _ = require('lodash')

exports.up = async knex => {
  await knex.schema
    .alterTable('pageTree', table => {
      table.integer('sortOrder').unsigned()
    })

  const rows = await knex('pageTree')
    .select('id', 'parent', 'localeCode', 'isFolder', 'title')

  const grouped = _.groupBy(rows, row => `${row.localeCode || ''}:${row.parent || 0}`)
  const updates = []

  _.forEach(grouped, siblings => {
    const ordered = _.orderBy(siblings, ['isFolder', 'title'], ['desc', 'asc'])
    ordered.forEach((node, idx) => {
      updates.push({
        id: node.id,
        sortOrder: idx + 1
      })
    })
  })

  for (const chunk of _.chunk(updates, 60)) {
    await Promise.all(
      chunk.map(entry =>
        knex('pageTree')
          .where('id', entry.id)
          .update({ sortOrder: entry.sortOrder })
      )
    )
  }
}

exports.down = knex => { }
