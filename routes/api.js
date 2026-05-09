const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')
const db = require('../db')
const jwt = require('jsonwebtoken')

const queryAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.pool.query(sql, params, (err, results) => {
      if (err) return reject(err)
      resolve(results)
    })
  })

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

const buildFilter = (query) => {
  const conditions = ['1=1']
  const params = []

  if (query.keyword) {
    const keyword = `%${String(query.keyword).trim()}%`
    conditions.push('(CAST(id AS CHAR) LIKE ? OR customer LIKE ?)')
    params.push(keyword, keyword)
  }

  if (query.status) {
    conditions.push('status = ?')
    params.push(query.status)
  }

  if (query.category) {
    conditions.push('category = ?')
    params.push(query.category)
  }

  if (query.role) {
    conditions.push('role = ?')
    params.push(query.role)
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

// health check
router.get('/status', async (req, res) => {
  try {
    const results = await queryAsync('SELECT 1 + 1 AS result')
    const value = Array.isArray(results) && results[0] ? results[0].result : 2
    res.json({ success: true, db: value })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/', (req, res) => {
  res.json({ message: 'API router is working.', timestamp: Date.now() })
})

router.get('/dashboard/stats', async (req, res) => {
  try {
    const orderResult = await queryAsync('SELECT COUNT(*) AS totalOrders, SUM(amount) AS totalRevenue FROM orders')
    const userResult = await queryAsync("SELECT COUNT(*) AS activeUsers FROM users WHERE status = '正常'")
    const shipmentResult = await queryAsync("SELECT COUNT(*) AS pendingShipments FROM orders WHERE status = '待发货'")

    res.json({
      totalOrders: orderResult[0].totalOrders || 0,
      totalRevenue: Number(orderResult[0].totalRevenue || 0),
      activeUsers: userResult[0].activeUsers || 0,
      pendingShipments: shipmentResult[0].pendingShipments || 0
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/orders', async (req, res) => {
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

router.post('/orders/batch-update', async (req, res) => {
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

router.get('/orders/:id', async (req, res) => {
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

router.put('/orders/:id/status', async (req, res) => {
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

router.get('/products', async (req, res) => {
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

router.post('/products/batch-update', async (req, res) => {
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

router.post('/products', async (req, res) => {
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

router.get('/products/:id', async (req, res) => {
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

router.put('/products/:id/stock', async (req, res) => {
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

router.get('/users', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1
    const pageSize = Number(req.query.pageSize) || 5
    const offset = (page - 1) * pageSize
    let conditions = ['1=1']
    const params = []

    if (req.query.keyword) {
      const keyword = `%${String(req.query.keyword).trim()}%`
      conditions.push('(CAST(id AS CHAR) LIKE ? OR name LIKE ? OR email LIKE ?)')
      params.push(keyword, keyword, keyword)
    }

    if (req.query.role) {
      conditions.push('role = ?')
      params.push(req.query.role)
    }

    if (req.query.status) {
      conditions.push('status = ?')
      params.push(req.query.status)
    }

    const where = `WHERE ${conditions.join(' AND ')}`
    const totalResult = await queryAsync(`SELECT COUNT(*) AS total FROM users ${where}`, params)
    const rows = await queryAsync(`SELECT id, name, email, role, status, remark FROM users ${where} LIMIT ? OFFSET ?`, [...params, pageSize, offset])

    res.json({ data: rows, total: totalResult[0].total || 0 })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/users/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { status } = req.body
    const result = await queryAsync('UPDATE users SET status = ? WHERE id = ?', [status, id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '用户未找到' })
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.post('/auth/register', async (req, res) => {
  try {
    const { name, password, email, role, remark } = req.body
    const exists = await queryAsync('SELECT id FROM users WHERE name = ?', [name])
    if (exists.length) {
      return res.status(400).json({ message: '用户名已存在' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const result = await queryAsync(
      'INSERT INTO users (name, password, email, role, status, remark) VALUES (?, ?, ?, ?, ?, ?)',
      [name, hashedPassword, email, role, '正常', remark || '']
    )
    res.json({ id: result.insertId, name, email, role })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})
const secretKey = 'my_secret_key'
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const users = await queryAsync('SELECT id, name, email, role, avatar, password FROM users WHERE name = ?', [username])
    if (!users.length) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }

    const user = users[0]
    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) {
      return res.status(401).json({ message: '用户名或密码错误' })
    }
    const token = 'Bearer ' + jwt.sign({ username: req.body.username }, secretKey, { expiresIn: '2h' });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || '', token })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const users = await queryAsync('SELECT id, name, email, role, status, avatar, remark FROM users WHERE id = ?', [id])
    if (!users.length) {
      return res.status(404).json({ message: '用户未找到' })
    }
    res.json({ data: users[0] })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.put('/users/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, email, avatarBase64, remark } = req.body
    if (!name || !email) {
      return res.status(400).json({ message: '用户名和邮箱不能为空' })
    }

    const users = await queryAsync('SELECT avatar FROM users WHERE id = ?', [id])
    if (!users.length) {
      return res.status(404).json({ message: '用户未找到' })
    }

    const exists = await queryAsync('SELECT id FROM users WHERE name = ? AND id <> ?', [name, id])
    if (exists.length) {
      return res.status(400).json({ message: '用户名已存在' })
    }

    let avatar = users[0].avatar || ''
    if (avatarBase64) {
      avatar = saveAvatarFile(id, avatarBase64)
    }

    await queryAsync('UPDATE users SET name = ?, email = ?, avatar = ?, remark = ? WHERE id = ?', [name, email, avatar, remark, id])
    const updated = await queryAsync('SELECT id, name, email, role, status, avatar, remark FROM users WHERE id = ?', [id])
    res.json({ data: updated[0] })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: '用户名或邮箱已存在' })
    }
    res.status(500).json({ message: err.message })
  }
})

router.put('/users/:id/password', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: '当前密码和新密码均为必填项' })
    }

    const users = await queryAsync('SELECT password FROM users WHERE id = ?', [id])
    if (!users.length) {
      return res.status(404).json({ message: '用户未找到' })
    }

    const currentMatches = await bcrypt.compare(currentPassword, users[0].password)
    if (!currentMatches) {
      return res.status(400).json({ message: '当前密码错误' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await queryAsync('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

router.get('/after-sales', async (req, res) => {
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

router.put('/after-sales/:id/status', async (req, res) => {
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

router.get('/analytics', async (req, res) => {
  try {
    const salesTrend = await queryAsync(
      "SELECT DATE_FORMAT(order_date, '%Y-%m-%d') AS date, SUM(amount) AS value FROM orders GROUP BY DATE_FORMAT(order_date, '%Y-%m-%d') ORDER BY DATE_FORMAT(order_date, '%Y-%m-%d') ASC"
    )
    const categoryShare = await queryAsync('SELECT category AS name, COUNT(*) AS value FROM products GROUP BY category')
    res.json({ data: { salesTrend, categoryShare } })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

module.exports = router
