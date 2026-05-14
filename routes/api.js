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

router.get('/songs', async (req, res) => {
  // 获取分页参数，默认第1页，每页10条
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const { keyword } = req.query;

  // 从 JWT 获取真实 userId，未登录时返回空数据
  const userId = await getUserIdFromToken(req);

  if (!userId) {
    return res.json({ code: 200, data: [], total: 0, page, pageSize });
  }

  // 计算偏移量
  const offset = (page - 1) * pageSize;

  let sql = 'SELECT * FROM liked_songs';
  const conditions = ['user_id = ?'];
  const values = [userId];

  try {
    if (keyword) {
      const isNumeric = /^\d+$/.test(keyword);
      if (isNumeric) {
        conditions.push('id = ?');
        values.push(keyword);
      } else {
        conditions.push('(name LIKE ? OR (JSON_LENGTH(ar) > 0 AND JSON_EXTRACT(ar, "$[0].name") LIKE ?))');
        const likeParam = `%${keyword}%`;
        values.push(likeParam, likeParam);
      }
    }

    sql += ' WHERE ' + conditions.join(' AND ');
    
    // 先查询总数
    const countSql = 'SELECT COUNT(*) as total FROM liked_songs WHERE ' + conditions.join(' AND ');
    const countResult = await queryAsync(countSql, values);
    const total = countResult[0]?.total;

    // 再查询分页数据
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    values.push(pageSize, offset);
    
    const rows = await queryAsync(sql, values);

    res.json({ 
      code: 200, 
      data: rows, 
      total,
      page,
      pageSize
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ code: 500, message: 'Server Error' });
  }
});

// 新增/删除接口：根据 ID 存在性自动切换操作

// 辅助函数：从 JWT 获取用户ID
const getUserIdFromToken = async (req) => {
  if (req.user && req.user.username) {
    const users = await queryAsync('SELECT id FROM users WHERE name = ?', [req.user.username]);
    if (users.length > 0) return users[0].id;
  }
  return null;
};

router.post('/songs', async (req, res) => {
  const { id, name, ar, al, dt } = req.body;
  // 从 JWT 获取真实 userId
  const userId = await getUserIdFromToken(req);

  if (!userId) {
    return res.status(401).json({ code: 401, message: '未授权，请先登录' });
  }

  if (!id) {
    return res.status(400).json({ code: 400, message: '缺少必要参数: id' });
  }

  try {
    // 1. 检查歌曲是否已存在（按用户区分）
    const checkSql = 'SELECT id FROM liked_songs WHERE id = ? AND user_id = ?';
    const existing = await queryAsync(checkSql, [id, userId]);

    if (existing && existing.length > 0) {
      // 2. 存在则删除
      const deleteSql = 'DELETE FROM liked_songs WHERE id = ?';
      await queryAsync(deleteSql, [id]);
      return res.json({ code: 200, message: '已取消喜欢', action: 'deleted' });
    } else {
      // 3. 不存在则添加
      const artistJson = Array.isArray(ar) ? JSON.stringify(ar) : ar;
      const albumJson = al ? (typeof al === 'object' ? JSON.stringify(al) : al) : null;
      
      const insertSql = 'INSERT INTO liked_songs (id, name, ar, al, dt, user_id, play_count) VALUES (?, ?, ?, ?, ?, ?, 0)';
      await queryAsync(insertSql, [id, name, artistJson, albumJson, dt, userId]);
      
      return res.json({ code: 200, message: '已添加喜欢', action: 'added' });
    }
  } catch (error) {
    console.error('操作失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误', error: error.message });
  }
});

/**
 * 添加播放历史
 * 逻辑：如果歌曲已存在，则更新播放时间和播放次数；如果不存在，则插入新记录。
 */
router.post('/history', async (req, res) => {
  const { id, name, ar, al, dt } = req.body;
  // 从 JWT 获取真实 userId
  const userId = await getUserIdFromToken(req);

  if (!userId) {
    return res.status(401).json({ code: 401, message: '未授权，请先登录' });
  }

  if (!id || !name || !dt) {
    return res.status(400).json({ code: 400, message: '缺少必要参数: id, name, dt' });
  }

  try {
    // 1. 检查是否已存在该用户的这条播放记录
    const checkSql = 'SELECT id, play_count FROM history_songs WHERE id = ? AND user_id = ?';
    const existing = await queryAsync(checkSql, [id, userId]);

    if (existing && existing.length > 0) {
      // 2. 存在则更新：刷新时间，播放次数+1
      const newPlayCount = existing[0].play_count + 1;
      const updateSql = 'UPDATE history_songs SET created_at = CURRENT_TIMESTAMP, play_count = ? WHERE id = ? AND user_id = ?';
      await queryAsync(updateSql, [newPlayCount, id, userId]);
      return res.json({ code: 200, message: '播放历史已更新', action: 'updated', play_count: newPlayCount });
    } else {
      // 3. 不存在则插入
      // 处理 JSON 字段，确保存入的是字符串格式（如果 mysql2 配置未自动序列化）
      const artistJson = Array.isArray(ar) ? JSON.stringify(ar) : ar;
      const albumJson = al ? (typeof al === 'object' ? JSON.stringify(al) : al) : null;

      const insertSql = `INSERT INTO history_songs (id, name, ar, al, dt, user_id, play_count, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`;
      await queryAsync(insertSql, [id, name, artistJson, albumJson, dt, userId]);
      
      return res.json({ code: 200, message: '已添加播放历史', action: 'added' });
    }
  } catch (error) {
    console.error('添加播放历史失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误', error: error.message });
  }
});

router.get('/history', async (req, res) => {
  // 1. 获取分页参数，默认第1页，每页20条
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 50;
  const { keyword } = req.query; // 搜索关键词
  
  // 从 JWT 获取真实 userId，未登录时返回空数据
  const userId = await getUserIdFromToken(req);

  if (!userId) {
    return res.json({ code: 200, data: [], total: 0, page, pageSize });
  }
  
  // 计算偏移量 offset = (page - 1) * pageSize
  const offset = (page - 1) * pageSize;
  
  // 2. 构建查询条件
  const conditions = ['user_id = ?'];
  const values = [userId];

  try {
    // 如果有搜索关键词，添加模糊查询条件
    if (keyword) {
      const isNumeric = /^\d+$/.test(keyword);
      if (isNumeric) {
        // 如果是数字，尝试匹配歌曲ID
        conditions.push('id = ?');
        values.push(keyword);
      } else {
        // 如果是文本，匹配歌名或艺术家名称
        // JSON_SEARCH 用于在 JSON 数组中查找包含特定字符串的元素
        conditions.push('(name LIKE ? OR JSON_SEARCH(ar, "one", ?) IS NOT NULL)');
        const likeParam = `%${keyword}%`;
        values.push(likeParam, likeParam);
      }
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ');

    // 3. 获取总记录数 (用于前端分页显示)
    const countSql = `SELECT COUNT(*) as total FROM history_songs ${whereClause}`;
    const countResult = await queryAsync(countSql, values);
    const total = countResult[0]?.total || 0;

    // 4. 获取当前页数据
    // 按播放时间(created_at)倒序排列，最近播放的在前面
    const listSql = `SELECT * FROM history_songs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const listValues = [...values, pageSize, offset];
    const rows = await queryAsync(listSql, listValues);

    // 5. 处理返回数据：解析 JSON 字段
    // MySQL 驱动通常返回 JSON 字段为字符串，需要手动 parse 以便前端直接使用
    const formattedRows = rows.map(row => {
      return {
        ...row,
        ar: typeof row.ar === 'string' ? JSON.parse(row.ar) : row.ar,
        al: typeof row.al === 'string' ? JSON.parse(row.al) : row.al
      };
    });

    res.json({ 
      code: 200, 
      data: formattedRows, 
      total,
      page,
      pageSize
    });
  } catch (error) {
    console.error('查询播放历史失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误', error: error.message });
  }
});

/**
 * 清空当前用户的所有播放历史记录
 * DELETE /history/clear
 */
router.delete('/history/clear', async (req, res) => {
  // 从 JWT 获取真实 userId
  const userId = await getUserIdFromToken(req);

  if (!userId) {
    return res.status(401).json({ code: 401, message: '未授权，请先登录' });
  }

  try {
    // 执行删除操作，只删除当前用户的记录
    const deleteSql = 'DELETE FROM history_songs WHERE user_id = ?';
    const result = await queryAsync(deleteSql, [userId]);

    // result.affectedRows 表示被删除的行数
    const deletedCount = result.affectedRows || 0;

    if (deletedCount > 0) {
      return res.json({ 
        code: 200, 
        message: '播放历史已清空', 
        data: { deletedCount } 
      });
    } else {
      return res.json({ 
        code: 200, 
        message: '没有可清空的记录', 
        data: { deletedCount: 0 } 
      });
    }
  } catch (error) {
    console.error('清空播放历史失败:', error);
    res.status(500).json({ 
      code: 500, 
      message: '服务器内部错误', 
      error: error.message 
    });
  }
});


/**
 * 记录播放并同步更新播放次数
 * GET /songs/play-sync/:id
 * 逻辑：
 * 1. 在 history_songs 中记录/更新播放信息，并将 play_count + 1
 * 2. 检查 liked_songs 中是否存在该歌曲，如果存在，也将 play_count + 1
 */
router.post('/songs/play-sync/:songId', async (req, res) => {
  const { songId } = req.params;
  // 从 JWT 获取真实 userId
  const userId = await getUserIdFromToken(req);

  if (!userId) {
    return res.status(401).json({ code: 401, message: '未授权' });
  }

  // 从请求体获取歌曲详细信息（如果是第一次播放，需要这些信息来插入历史表）
  // 如果前端只传 ID，后端可能需要先去音乐服务获取详情，这里假设前端传了必要信息
  const { name, ar, al, dt } = req.body;

  try {
    // 1. 处理播放历史 (history_songs)
    // 检查是否已存在该用户对该歌曲的历史记录
    const checkHistorySql = 'SELECT id, play_count FROM history_songs WHERE id = ? AND user_id = ?';
    const historyRecord = await queryAsync(checkHistorySql, [songId, userId]);

    if (historyRecord && historyRecord.length > 0) {
      // 存在则更新播放次数 +1
      const newPlayCount = (historyRecord[0].play_count || 0) + 1;
      const updateHistorySql = 'UPDATE history_songs SET play_count = ?, created_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?';
      await queryAsync(updateHistorySql, [newPlayCount, songId, userId]);
    } else {
      // 不存在则插入新记录
      // 注意：ar 和 al 可能需要根据实际数据结构进行 JSON.stringify 处理
      const artistJson = Array.isArray(ar) ? JSON.stringify(ar) : ar;
      const albumJson = al ? (typeof al === 'object' ? JSON.stringify(al) : al) : null;
      
      const insertHistorySql = `
        INSERT INTO history_songs (id, name, ar, al, dt, user_id, play_count) 
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `;
      await queryAsync(insertHistorySql, [songId, name, artistJson, albumJson, dt, userId]);
    }

    // 2. 处理喜欢歌曲 (liked_songs)
    // 检查该歌曲是否在用户的喜欢列表中
    const checkLikedSql = 'SELECT id, play_count FROM liked_songs WHERE id = ? AND user_id = ?';
    const likedRecord = await queryAsync(checkLikedSql, [songId, userId]);

    if (likedRecord && likedRecord.length > 0) {
      // 如果是喜欢的歌曲，播放次数 +1
      const newLikedPlayCount = (likedRecord[0].play_count || 0) + 1;
      const updateLikedSql = 'UPDATE liked_songs SET play_count = ? WHERE id = ? AND user_id = ?';
      await queryAsync(updateLikedSql, [newLikedPlayCount, songId, userId]);
    }

    return res.json({ code: 200, message: '播放记录同步成功' });

  } catch (error) {
    console.error('同步播放计数失败:', error);
    res.status(500).json({ code: 500, message: '服务器内部错误', error: error.message });
  }
});

// ==================== 图片管理接口 ====================

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
 * 上传图片
 * POST /api/images/upload
 */
router.post('/images/upload', async (req, res) => {
  try {
    const { title, description, category, isPublic, imageBase64 } = req.body
    if (!title || !imageBase64) {
      return res.status(400).json({ message: '缺少必要参数: title, imageBase64' })
    }

    // 从 JWT 获取上传者
    let author = '匿名'
    let userId = null
    if (req.user && req.user.username) {
      const users = await queryAsync('SELECT id, name FROM users WHERE name = ?', [req.user.username])
      if (users.length > 0) {
        userId = users[0].id
        author = users[0].name
      }
    }

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
 * 权限逻辑：
 * - 未登录用户：只能看到公开图片 (is_public = 1)
 * - 已登录用户：可以看到自己的所有图片 + 他人的公开图片
 */ 
router.get('/images', async (req, res) => {
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
      // 已登录用户：可以看到自己的所有图片 + 他人的公开图片
      conditions.push('(user_id = ? OR is_public = 1)')
      params.push(currentUserId)
    } else {
      // 未登录用户：只能看到公开图片
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
router.delete('/images/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const images = await queryAsync('SELECT * FROM images WHERE id = ?', [id])
    if (!images.length) {
      return res.status(404).json({ message: '图片未找到' })
    }

    // 删除物理文件
    const image = images[0]
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
