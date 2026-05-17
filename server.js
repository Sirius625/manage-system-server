/**
 * 管理后台后端服务 - 入口文件
 * 
 * 基于 Express + MySQL 构建的企业级后台管理系统 API 服务。
 * 提供认证、订单、商品、用户、歌曲、图片、文章等模块的 RESTful API。
 * 
 * @module server
 */

// 环境变量加载策略：
// 1. 优先加载 .env 文件（生产环境配置）
// 2. 如果 NODE_ENV 明确指定为 development，则加载 .env.development
// 3. 如果 .env 文件不存在，回退到 .env.development
const fs = require('fs')
let envFile = '.env'
if (process.env.NODE_ENV === 'development') {
  envFile = '.env.development'
} else if (!fs.existsSync('.env')) {
  envFile = '.env.development'
}
require('dotenv').config({ path: envFile })
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
const { expressjwt } = require('express-jwt');

const app = express()
const port = process.env.PORT || 3030
const apiRouter = require('./routes/api')
const { pool, initDatabase, hashLegacyPasswords } = require('./db')

// ==================== 中间件配置 ====================

// 跨域支持
app.use(cors())
// 解析 JSON 请求体（限制 150MB 以支持 Base64 视频上传）
app.use(bodyParser.json({ limit: '150mb' }))
// 解析 URL 编码请求体
app.use(bodyParser.urlencoded({ extended: true }))
// 上传文件存储目录（默认项目外部，避免更新代码时丢失）
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(__dirname, '..', 'uploads')
// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
  fs.mkdirSync(path.join(UPLOAD_DIR, 'images'), { recursive: true })
  fs.mkdirSync(path.join(UPLOAD_DIR, 'videos'), { recursive: true })
}
// 静态文件服务 - 提供上传的图片和头像访问
app.use('/uploads', express.static(UPLOAD_DIR))

// ==================== JWT 认证中间件 ====================
const secretKey = 'my_secret_key'
app.use(
  expressjwt({
    secret: secretKey,
    algorithms: ['HS256'],
    requestProperty: 'user' 
}).unless({
  path: [
    '/api/auth/login',          // 登录接口无需认证
    '/api/auth/register',       // 注册接口无需认证
    '/api/status',              // 健康检查接口无需认证
    '/api/images',              // 图片列表（公开图片可匿名访问）
    '/api/videos',              // 视频列表（公开视频可匿名访问）
    '/api/history',             // 播放历史（游客可访问但不会记录）
    { url: /^\/api\/songs\/play-sync/, methods: ['POST'] },  // 播放同步（游客可访问）
    { url: /^\/api\/articles$/, methods: ['GET'] },           // 文章列表公开访问
    { url: /^\/api\/articles\/categories$/, methods: ['GET'] }, // 文章分类公开访问
    { url: /^\/api\/articles\/\d+$/, methods: ['GET'] },      // 文章详情公开访问
    '/'
  ] 
}))

// ==================== 路由配置 ====================

// 根路径健康检查
app.get('/', (req, res) => {
  res.json({ message: 'Project server is running.' })
})

// 挂载 API 路由
app.use('/api', apiRouter)

// ==================== 服务启动 ====================

initDatabase()
  .then(() => hashLegacyPasswords())
  .then(() => {
    console.log('Database initialized and passwords verified successfully.')
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('MySQL connection failed:', err.message)
      } else {
        console.log('MySQL connected successfully.')
        connection.release()
      }
    })
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`)
    })
  })
  .catch((err) => {
    console.error('Database initialization failed:', err.message || err)
    process.exit(1)
  })
