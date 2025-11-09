exports.up = knex => {
  return knex.schema.createTable('importTasks', table => {
    table.increments('id').primary()
    table.string('status').notNullable().defaultTo('queued')
    table.string('targetPath').notNullable().defaultTo('')
    table.string('locale').notNullable()
    table.integer('userId').notNullable()
    table.string('originalName').notNullable()
    table.string('uploadPath').notNullable()
    table.integer('parentId')
    table.integer('total').notNullable().defaultTo(0)
    table.integer('created').notNullable().defaultTo(0)
    table.integer('updated').notNullable().defaultTo(0)
    table.integer('failed').notNullable().defaultTo(0)
    table.json('errors').notNullable().defaultTo('[]')
    table.string('message').notNullable().defaultTo('')
    table.string('createdAt').notNullable()
    table.string('updatedAt').notNullable()
    table.string('completedAt')
  })
}

exports.down = knex => {
  return knex.schema.dropTableIfExists('importTasks')
}

