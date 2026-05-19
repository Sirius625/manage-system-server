/**
 * 数据库用户初始化脚本
 * 使用 root 用户创建 management_system 用户并授权
 */
const mysql = require('mysql')
require('dotenv').config()

const rootConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: 'root',
  password: 'HJLzzx520!!!', // 本地开发 root 密码
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  multipleStatements: true
}

const dbUser = process.env.DB_USER || 'management_system'
const dbPass = process.env.DB_PASSWORD || 'KbaC7YydkxRmGp52'
const dbName = process.env.DB_NAME || 'management_system'

const connection = mysql.createConnection(rootConfig)

connection.connect((err) => {
  if (err) {
    console.error('连接 MySQL 失败（请检查 root 密码）:', err.message)
    process.exit(1)
  }

  console.log('已连接 MySQL，开始创建用户和数据库...')

  const sql = `
    CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    
    CREATE USER IF NOT EXISTS '${dbUser}'@'localhost' IDENTIFIED BY '${dbPass}';
    CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPass}';
    
    GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'localhost';
    GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'%';
    
    FLUSH PRIVILEGES;
  `

  connection.query(sql, (queryErr, results) => {
    if (queryErr) {
      console.error('执行 SQL 失败:', queryErr.message)
      connection.end()
      process.exit(1)
    }
    console.log('数据库和用户创建成功！')
    console.log(`数据库: ${dbName}`)
    console.log(`用户: ${dbUser}`)
    connection.end()
    process.exit(0)
  })
})
