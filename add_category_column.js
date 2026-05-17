const mysql = require('mysql')
require('dotenv').config()

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'management_system',
  multipleStatements: true
})

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) return reject(err)
      resolve(results)
    })
  })

async function main() {
  try {
    // 检查 category 列是否存在
    const columns = await queryAsync(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'images' AND COLUMN_NAME = 'category'`
    )
    
    if (columns[0].cnt === 0) {
      await queryAsync('ALTER TABLE images ADD COLUMN category VARCHAR(50) DEFAULT "其他" COMMENT "分类：运动/日常/游戏/其他"')
      console.log('✅ 已添加 category 列到 images 表')
    } else {
      console.log('ℹ️ category 列已存在')
    }
    
    console.log('✅ 数据库迁移完成')
    process.exit(0)
  } catch (err) {
    console.error('❌ 迁移失败:', err.message)
    process.exit(1)
  }
}

main()
