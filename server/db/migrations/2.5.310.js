/* global WIKI */

const dbCompat = {
  charset: (WIKI.config.db.type === 'mysql' || WIKI.config.db.type === 'mariadb')
}

exports.up = knex => {
  return knex.schema.createTable('importTasks', table => {
    if (dbCompat.charset) {
      table.charset('utf8mb4')
    }
    table.increments('id').primary()
    table.string('status').notNullable().defaultTo('queued')
    table.string('targetPath').notNullable().defaultTo('')
    table.string('locale').notNullable()
    table.integer('userId').unsigned().notNullable()
    table.string('originalName').notNullable()
    table.string('uploadPath').notNullable()
    table.integer('parentId').unsigned()
    table.integer('total').unsigned().notNullable().defaultTo(0)
    table.integer('created').unsigned().notNullable().defaultTo(0)
    table.integer('updated').unsigned().notNullable().defaultTo(0)
    table.integer('failed').unsigned().notNullable().defaultTo(0)
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

