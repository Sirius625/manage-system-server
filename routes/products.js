const express = require('express')
const router = express.Router()
const { queryAsync } = require('./common')

// 商品列表
router.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 5
    const offset = (page - 1) * pageSize
    let conditions = ['1=1']
    const params = []

    if (req.query.keyword) {
      const keyword = `%${String(req.query.keyword).trim()}%`
      conditions.push('(CAST(id AS CHAR) LIKE ? OR name LIKE ?)')
      params.push(keyword, keyword)
    }

    if (req.query.category) {
      conditions.push('category = ?')
      params.push(req.query.category)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const totalResult = await queryAsync(`SELECT COUNT(*) AS total FROM products ${where}`, params)
    const rows = await queryAsync(`SELECT * FROM products ${where} LIMIT ? OFFSET ?`, [...params, pageSize, offset])

    res.json({ data: rows, total: totalResult[0].total || 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 批量更新商品状态
router.post('/batch-update', async (req, res) => {
  try {
    const { ids = [], status } = req.body
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ data: [] })
    }

    const placeholders = ids.map(() => '?').join(',')
    await queryAsync(`UPDATE products SET status = ? WHERE id IN (${placeholders})`, [status, ...ids])
    const updated = await queryAsync(`SELECT * FROM products WHERE id IN (${placeholders})`, ids)
    res.json({ data: updated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 新增商品
router.post('/', async (req, res) => {
  try {
    const { name, category, stock, price, status } = req.body
    if (!name || !category || typeof stock !== 'number' || typeof price !== 'number' || !status) {
      return res.status(400).json({ message: '缺少必要的商品字段' })
    }

    const idResult = await queryAsync('SELECT COALESCE(MAX(id), 2000) + 1 AS nextId FROM products')
    const nextId = idResult[0]?.nextId || 2001

    await queryAsync(
      'INSERT INTO products (id, name, category, stock, price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [nextId, name, category, stock, price, status]
    )

    const inserted = await queryAsync('SELECT * FROM products WHERE id = ?', [nextId])
    res.json({ data: inserted[0] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 获取商品详情
router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const productResult = await queryAsync('SELECT * FROM products WHERE id = ?', [id])
    if (!productResult.length) {
      return res.status(404).json({ message: '商品未找到' })
    }

    res.json({ data: productResult[0] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 更新商品库存
router.put('/:id/stock', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const stock = Number(req.body.stock)
    if (Number.isNaN(stock) || stock < 0) {
      return res.status(400).json({ message: '库存值必须为非负数' })
    }

    const result = await queryAsync('UPDATE products SET stock = ? WHERE id = ?', [stock, id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '商品未找到' })
    }

    const updated = await queryAsync('SELECT * FROM products WHERE id = ?', [id])
    res.json({ data: updated[0] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
