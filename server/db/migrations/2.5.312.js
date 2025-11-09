/* global WIKI */

const dbCompat = {
  charset: (WIKI.config.db.type === 'mysql' || WIKI.config.db.type === 'mariadb')
}

exports.up = knex => {
  return knex.schema.alterTable('importTasks', table => {
    if (dbCompat.charset) {
      table.charset('utf8mb4')
    }
    table.integer('processed').unsigned().notNullable().defaultTo(0)
    table.string('currentFile').notNullable().defaultTo('')
    table.json('progress').notNullable().defaultTo('[]')
  })
}

exports.down = knex => {
  return knex.schema.alterTable('importTasks', table => {
    table.dropColumn('processed')
    table.dropColumn('currentFile')
    table.dropColumn('progress')
  })
}

