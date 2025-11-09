exports.up = async knex => {
  const hasColumn = await knex.schema.hasColumn('importTasks', 'parentId')
  if (!hasColumn) {
    await knex.schema.alterTable('importTasks', table => {
      table.integer('parentId')
    })
  }
}

exports.down = async knex => {
  const hasColumn = await knex.schema.hasColumn('importTasks', 'parentId')
  if (hasColumn) {
    await knex.schema.alterTable('importTasks', table => {
      table.dropColumn('parentId')
    })
  }
}

