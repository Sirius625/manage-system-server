/**
 * 售后管理路由
 * 
 * 提供售后记录列表查询、状态更新等功能。
 * 
 * @module routes/after-sales
 */

const express = require('express')
const router = express.Router()
const { queryAsync } = require('./common')

/**
 * 获取售后记录列表（分页）
 * GET /api/after-sales
 * 
 * @query {number} page - 页码（默认1）
 * @query {number} pageSize - 每页条数（默认5）
 * @query {string} keyword - 搜索关键词
 * @query {string} status - 按状态筛选
 */
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 5
    const offset = (page - 1) * pageSize
    let conditions = ['1=1']
    const params = []

    if (req.query.keyword) {
      const keyword = `%${String(req.query.keyword).trim()}%`
      conditions.push('(CAST(id AS CHAR) LIKE ? OR CAST(order_id AS CHAR) LIKE ? OR `user` LIKE ?)')
      params.push(keyword, keyword, keyword)
    }

    if (req.query.status) {
      conditions.push('status = ?')
      params.push(req.query.status)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const totalResult = await queryAsync(`SELECT COUNT(*) AS total FROM after_sales ${where}`, params)
    const rows = await queryAsync(`SELECT * FROM after_sales ${where} LIMIT ? OFFSET ?`, [...params, pageSize, offset])

    res.json({ data: rows, total: totalResult[0].total || 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 更新售后状态
router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { status } = req.body
    const result = await queryAsync('UPDATE after_sales SET status = ? WHERE id = ?', [status, id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '售后记录未找到' })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
