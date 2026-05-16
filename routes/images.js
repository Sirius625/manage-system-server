const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const fs = require('fs')
const { queryAsync, saveImageFile } = require('./common')

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
 * 上传图片
 * POST /api/images/upload
 */
router.post('/upload', async (req, res) => {
  try {
    const { title, description, category, isPublic, imageBase64 } = req.body
    if (!title || !imageBase64) {
      return res.status(400).json({ message: '缺少必要参数: title, imageBase64' })
    }

    const { author, userId } = await getCurrentUser(req)

    // 保存图片文件
    const { url, path: filePath } = saveImageFile(imageBase64)

    // 插入数据库
    const result = await queryAsync(
      'INSERT INTO images (title, description, category, url, path, author, user_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [title, description || '', category || '其他', url, filePath, author, userId, isPublic !== undefined ? (isPublic ? 1 : 0) : 1]
    )

    const inserted = await queryAsync('SELECT * FROM images WHERE id = ?', [result.insertId])
    res.json({ data: inserted[0] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * 获取图片列表
 * GET /api/images
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

    if (req.query.keyword) {
      const keyword = `%${String(req.query.keyword).trim()}%`
      conditions.push('(title LIKE ? OR description LIKE ?)')
      params.push(keyword, keyword)
    }

    if (req.query.category) {
      conditions.push('category = ?')
      params.push(req.query.category)
    }

    if (req.query.isPublic !== undefined && req.query.isPublic !== '') {
      conditions.push('is_public = ?')
      params.push(req.query.isPublic === '1' || req.query.isPublic === 'true' ? 1 : 0)
    }

    if (req.query.userId) {
      conditions.push('user_id = ?')
      params.push(req.query.userId)
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const totalResult = await queryAsync(`SELECT COUNT(*) AS total FROM images ${where}`, params)
    const rows = await queryAsync(
      `SELECT * FROM images ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    )

    res.json({ data: rows, total: totalResult[0].total || 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

/**
 * 删除图片
 * DELETE /api/images/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const images = await queryAsync('SELECT * FROM images WHERE id = ?', [id])
    if (!images.length) {
      return res.status(404).json({ message: '图片未找到' })
    }

    // 权限校验：只有上传者或管理员可以删除
    const { author, userId } = await getCurrentUser(req)
    const image = images[0]
    if (image.user_id && image.user_id !== userId) {
      // 检查是否为管理员
      const users = await queryAsync('SELECT role FROM users WHERE id = ?', [userId])
      if (!users.length || users[0].role !== '管理员') {
        return res.status(403).json({ message: '无权删除此图片' })
      }
    }

    // 删除物理文件
    try {
      if (fs.existsSync(image.path)) {
        fs.unlinkSync(image.path)
      }
    } catch (e) {
      console.warn('删除图片文件失败:', e.message)
    }

    // 删除数据库记录
    await queryAsync('DELETE FROM images WHERE id = ?', [id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
