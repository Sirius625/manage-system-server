const db = require('../db')
const fs = require('fs')
const path = require('path')

/**
 * 通用异步查询封装
 */
const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.pool.query(sql, params, (err, results) => {
      if (err) return reject(err)
      resolve(results)
    })
  })

/**
 * 从 JWT 获取用户ID
 */
const getUserIdFromToken = async (req) => {
  if (req.user && req.user.username) {
    const users = await queryAsync('SELECT id FROM users WHERE name = ?', [req.user.username])
    if (users.length > 0) return users[0].id
  }
  return null
}

/**
 * 保存头像文件
 */
const saveAvatarFile = (userId, base64Data) => {
  const matches = String(base64Data).match(/^data:(image\/\w+);base64,(.+)$/)
  if (!matches) {
    throw new Error('头像数据格式不正确')
  }

  const ext = matches[1].split('/')[1]
  const buffer = Buffer.from(matches[2], 'base64')
  const uploadDir = path.resolve(__dirname, '..', 'uploads')
  fs.mkdirSync(uploadDir, { recursive: true })

  const fileName = `avatar-${userId}-${Date.now()}.${ext}`
  const filePath = path.join(uploadDir, fileName)
  fs.writeFileSync(filePath, buffer)

  return `/uploads/${fileName}`
}

/**
 * 保存上传的图片文件
 */
const saveImageFile = (base64Data) => {
  const matches = String(base64Data).match(/^data:(image\/\w+);base64,(.+)$/)
  if (!matches) {
    throw new Error('图片数据格式不正确')
  }

  const ext = matches[1].split('/')[1]
  const buffer = Buffer.from(matches[2], 'base64')
  const uploadDir = path.resolve(__dirname, '..', 'uploads', 'images')
  fs.mkdirSync(uploadDir, { recursive: true })

  const fileName = `image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const filePath = path.join(uploadDir, fileName)
  fs.writeFileSync(filePath, buffer)

  return {
    url: `/uploads/images/${fileName}`,
    path: filePath
  }
}

/**
 * 保存上传的视频文件
 */
const saveVideoFile = (base64Data) => {
  const matches = String(base64Data).match(/^data:(video\/\w+);base64,(.+)$/)
  if (!matches) {
    throw new Error('视频数据格式不正确')
  }

  const ext = matches[1].split('/')[1]
  const buffer = Buffer.from(matches[2], 'base64')
  const uploadDir = path.resolve(__dirname, '..', 'uploads', 'videos')
  fs.mkdirSync(uploadDir, { recursive: true })

  const fileName = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const filePath = path.join(uploadDir, fileName)
  fs.writeFileSync(filePath, buffer)

  return {
    url: `/uploads/videos/${fileName}`,
    path: filePath
  }
}

/**
 * 构建通用筛选条件
 */
const buildFilter = (query, tableAlias = '') => {
  const conditions = ['1=1']
  const params = []
  const prefix = tableAlias ? `${tableAlias}.` : ''

  if (query.keyword) {
    const keyword = `%${String(query.keyword).trim()}%`
    conditions.push(`(${prefix}CAST(id AS CHAR) LIKE ? OR ${prefix}customer LIKE ?)`)
    params.push(keyword, keyword)
  }

  if (query.status) {
    conditions.push(`${prefix}status = ?`)
    params.push(query.status)
  }

  if (query.category) {
    conditions.push(`${prefix}category = ?`)
    params.push(query.category)
  }

  if (query.role) {
    conditions.push(`${prefix}role = ?`)
    params.push(query.role)
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

module.exports = {
  queryAsync,
  getUserIdFromToken,
  saveAvatarFile,
  saveImageFile,
  saveVideoFile,
  buildFilter
}
