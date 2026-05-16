/**
 * 数据库连接与初始化模块
 * 
 * 提供 MySQL 连接池管理、数据库表结构初始化、遗留密码哈希升级等功能。
 * 
 * @module db
 */

const mysql = require('mysql')
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

/** 数据库基础连接配置（不含数据库名，用于初始化时创建数据库） */
const baseConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  multipleStatements: true
}

/** MySQL 连接池（指定数据库名，用于业务查询） */
const pool = mysql.createPool({
  ...baseConfig,
  database: process.env.DB_NAME || 'management_system'
})

/**
 * 初始化数据库表结构
 * 读取 init.sql 文件并执行，自动创建所需的数据库和表
 * 
 * @returns {Promise<void>}
 */
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

/**
 * 升级遗留密码哈希
 * 检测并更新数据库中未使用 bcrypt 加密的密码，确保密码安全性
 * 
 * @returns {Promise<void>}
 */
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
