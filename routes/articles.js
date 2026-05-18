const express = require('express')
const router = express.Router()
const { queryAsync } = require('./common')

// ==================== 文章分类 ====================

// 获取所有分类
router.get('/categories', async (req, res) => {
  try {
    const rows = await queryAsync('SELECT DISTINCT category FROM articles WHERE category IS NOT NULL AND category != "" ORDER BY category')
    const categories = rows.map(r => r.category)
    res.json({ success: true, data: categories })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// ==================== 文章 CRUD ====================

// 获取文章列表（支持分页、分类筛选、搜索）
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, category = '', keyword = '' } = req.query
    const offset = (Number(page) - 1) * Number(pageSize)
    let where = 'WHERE 1=1'
    const params = []

    if (category) {
      where += ' AND category = ?'
      params.push(category)
    }

    if (keyword) {
      where += ' AND (title LIKE ? OR content LIKE ? OR summary LIKE ?)'
      const kw = `%${keyword}%`
      params.push(kw, kw, kw)
    }

    const countResult = await queryAsync(`SELECT COUNT(*) as total FROM articles ${where}`, params)
    const total = countResult[0]?.total || 0

    const rows = await queryAsync(
      `SELECT id, title, summary, category, tags, author, likes, views, created_at, updated_at 
       FROM articles ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(pageSize), offset]
    )

    // 解析 tags JSON
    const articles = rows.map(row => ({
      ...row,
      tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : []
    }))

    res.json({ success: true, data: articles, total })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 获取单篇文章详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const rows = await queryAsync('SELECT * FROM articles WHERE id = ?', [id])
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '文章不存在' })
    }
    const article = rows[0]
    article.tags = article.tags ? (typeof article.tags === 'string' ? JSON.parse(article.tags) : article.tags) : []
    // 增加浏览量
    await queryAsync('UPDATE articles SET views = views + 1 WHERE id = ?', [id])
    res.json({ success: true, data: article })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 创建文章
router.post('/', async (req, res) => {
  try {
    const { title, content, summary, category, tags, cover } = req.body
    if (!title || !content) {
      return res.status(400).json({ success: false, message: '标题和内容不能为空' })
    }

    const author = req.user?.username || '匿名'
    const tagsJson = tags ? JSON.stringify(tags) : '[]'

    const result = await queryAsync(
      `INSERT INTO articles (title, content, summary, category, tags, cover, author) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, content, summary || '', category || '未分类', tagsJson, cover || '', author]
    )

    res.json({ success: true, data: { id: result.insertId }, message: '文章发布成功' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 更新文章
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { title, content, summary, category, tags, cover } = req.body

    const tagsJson = tags ? JSON.stringify(tags) : '[]'

    await queryAsync(
      `UPDATE articles SET title = ?, content = ?, summary = ?, category = ?, tags = ?, cover = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title, content, summary || '', category || '未分类', tagsJson, cover || '', id]
    )

    res.json({ success: true, message: '文章更新成功' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 删除文章
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    // 权限校验：只有作者或管理员可以删除
    const rows = await queryAsync('SELECT author FROM articles WHERE id = ?', [id])
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: '文章不存在' })
    }
    const articleAuthor = rows[0].author
    const currentUser = req.user?.username
    if (!currentUser) {
      return res.status(401).json({ success: false, message: '请先登录' })
    }
    if (currentUser !== articleAuthor) {
      // 检查是否为管理员
      const users = await queryAsync('SELECT role FROM users WHERE name = ?', [currentUser])
      if (!users.length || users[0].role !== '管理员') {
        return res.status(403).json({ success: false, message: '无权删除此文章' })
      }
    }
    await queryAsync('DELETE FROM articles WHERE id = ?', [id])
    res.json({ success: true, message: '文章删除成功' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 点赞文章
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params
    await queryAsync('UPDATE articles SET likes = likes + 1 WHERE id = ?', [id])
    res.json({ success: true, message: '点赞成功' })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

module.exports = router
