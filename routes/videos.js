const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const fs = require('fs')
const { queryAsync, saveVideoFile } = require('./common')

const secretKey = 'my_secret_key'

/**
 * 从请求中解析当前用户信息
 */
const getCurrentUser = async (req) => {
  let author = '匿名'
  let userId = null
  const authHeader = req.headers.authorization
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '')
      const decoded = jwt.verify(token, secretKey)
      if (decoded && decoded.username) {
        const users = await queryAsync('SELECT id, name FROM users WHERE name = ?', [decoded.username])
        if (users.length > 0) {
          userId = users[0].id
          author = users[0].name
        }
      }
    } catch (e) {
      // token 无效，视为匿名用户
    }
  }
  return { author, userId }
}

/**
 * 上传视频
 * POST /api/videos/upload
 */
router.post('/upload', async (req, res) => {
  try {
    const { title, description, isPublic, videoBase64, fileSize, duration } = req.body
    if (!title || !videoBase64) {
      return res.status(400).json({ message: '缺少必要参数: title, videoBase64' })
    }

    // 限制视频大小（最大 100MB）
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB
    const rawSize = Buffer.byteLength(videoBase64, 'utf-8')
    const estimatedSize = Math.round(rawSize * 0.75) // base64 转二进制约 75%
    if (estimatedSize > MAX_VIDEO_SIZE) {
      return res.status(400).json({ message: '视频文件过大，最大支持 100MB' })
    }

    const { author, userId } = await getCurrentUser(req)

    // 保存视频文件
    const { url, path: filePath } = saveVideoFile(videoBase64)

    // 插入数据库
    const result = await queryAsync(
      'INSERT INTO videos (title, description, url, path, file_size, duration, author, user_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description || '', url, filePath, fileSize || estimatedSize, duration || 0, author, userId, isPublic !== undefined ? (isPublic ? 1 : 0) : 1]
    )

    const inserted = await queryAsync('SELECT * FROM videos WHERE id = ?', [result.insertId])
    res.json({ data: inserted[0] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * 获取视频列表
 * GET /api/videos
 */
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 20
    const offset = (page - 1) * pageSize
    let conditions = []
    const params = []

    // 尝试从 JWT 获取当前用户
    let currentUserId = null
    const authHeader = req.headers.authorization
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const decoded = jwt.verify(token, secretKey)
        if (decoded && decoded.username) {
          const users = await queryAsync('SELECT id FROM users WHERE name = ?', [decoded.username])
          if (users.length > 0) {
            currentUserId = users[0].id
          }
        }
      } catch (e) {
        // token 无效，视为未登录用户
      }
    }

    if (currentUserId) {
      conditions.push('(user_id = ? OR is_public = 1)')
      params.push(currentUserId)
    } else {
      conditions.push('is_public = 1')
    }

    if (req.query.isPublic !== undefined && req.query.isPublic !== '') {
      conditions.push('is_public = ?')
      params.push(Number(req.query.isPublic))
    }

    if (req.query.keyword) {
      const keyword = `%${String(req.query.keyword).trim()}%`
      conditions.push('(title LIKE ? OR description LIKE ?)')
      params.push(keyword, keyword)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const totalResult = await queryAsync(`SELECT COUNT(*) AS total FROM videos ${where}`, params)
    const rows = await queryAsync(
      `SELECT * FROM videos ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    res.json({ data: rows, total: totalResult[0].total || 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * 删除视频
 * DELETE /api/videos/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const videos = await queryAsync('SELECT * FROM videos WHERE id = ?', [id])
    if (!videos.length) {
      return res.status(404).json({ message: '视频未找到' })
    }

    // 权限校验：只有上传者或管理员可以删除
    const { author, userId } = await getCurrentUser(req)
    const video = videos[0]
    if (video.user_id && video.user_id !== userId) {
      const users = await queryAsync('SELECT role FROM users WHERE id = ?', [userId])
      if (!users.length || users[0].role !== '管理员') {
        return res.status(403).json({ message: '无权删除此视频' })
      }
    }

    // 删除物理文件
    try {
      if (fs.existsSync(video.path)) {
        fs.unlinkSync(video.path)
      }
    } catch (e) {
      console.warn('删除视频文件失败:', e.message)
    }

    // 删除数据库记录
    await queryAsync('DELETE FROM videos WHERE id = ?', [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
