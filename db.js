const mysql = require('mysql')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  multipleStatements: true
}

const pool = mysql.createPool({
  ...baseConfig,
  database: process.env.DB_NAME || 'management_system'
})

const initDatabase = () =>
  new Promise((resolve, reject) => {
    const initSql = fs.readFileSync(path.resolve(__dirname, 'init.sql'), 'utf8')
    const connection = mysql.createConnection(baseConfig)
    connection.connect((err) => {
      if (err) {
        connection.end()
        return reject(err)
      }
      connection.query(initSql, (queryErr) => {
        connection.end()
        if (queryErr) {
          return reject(queryErr)
        }
        resolve()
      })
    })
  })

const hashLegacyPasswords = () =>
  new Promise((resolve, reject) => {
    pool.query(
      "SELECT id, password FROM users WHERE password NOT LIKE '$2a$%' AND password NOT LIKE '$2b$%' AND password NOT LIKE '$2y$%'",
      async (err, results) => {
        if (err) return reject(err)
        if (!results || !results.length) return resolve()

        try {
          for (const row of results) {
            const hashed = await bcrypt.hash(row.password, 10)
            await new Promise((res, rej) => {
              pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, row.id], (updateErr) => {
                if (updateErr) return rej(updateErr)
                res()
              })
            })
          }
          resolve()
        } catch (hashErr) {
          reject(hashErr)
        }
      }
    )
  })

module.exports = {
  pool,
  initDatabase,
  hashLegacyPasswords
}
