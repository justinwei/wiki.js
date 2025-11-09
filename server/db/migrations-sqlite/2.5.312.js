exports.up = knex => {
  return knex.schema.alterTable('importTasks', table => {
    table.integer('processed').notNullable().defaultTo(0)
    table.string('currentFile').notNullable().defaultTo('')
    table.json('progress').notNullable().defaultTo('[]')
  })
}

exports.down = () => { }

