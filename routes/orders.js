const express = require('express')
const router = express.Router()
const { queryAsync, buildFilter } = require('./common')

// 订单列表
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 5
    const offset = (page - 1) * pageSize
    const filter = buildFilter(req.query)

    const totalResult = await queryAsync(`SELECT COUNT(*) AS total FROM orders ${filter.where}`, filter.params)
    const rows = await queryAsync(
      `SELECT * FROM orders ${filter.where} ORDER BY order_date DESC LIMIT ? OFFSET ?`,
      [...filter.params, pageSize, offset]
    )

    res.json({ data: rows, total: totalResult[0].total || 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 批量更新订单状态
router.post('/batch-update', async (req, res) => {
  try {
    const { ids = [], status } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ data: [] })
    }

    const placeholders = ids.map(() => '?').join(',')
    await queryAsync(`UPDATE orders SET status = ? WHERE id IN (${placeholders})`, [status, ...ids])
    const updated = await queryAsync(`SELECT * FROM orders WHERE id IN (${placeholders})`, ids)
    res.json({ data: updated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 获取订单详情
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const orderResult = await queryAsync('SELECT * FROM orders WHERE id = ?', [id])
    if (!orderResult.length) {
      return res.status(404).json({ message: '订单未找到' })
    }

    const items = await queryAsync('SELECT name, qty, price FROM order_items WHERE order_id = ?', [id])
    res.json({ data: { ...orderResult[0], items } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 更新订单状态
router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { status } = req.body
    const result = await queryAsync('UPDATE orders SET status = ? WHERE id = ?', [status, id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '订单未找到' })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
