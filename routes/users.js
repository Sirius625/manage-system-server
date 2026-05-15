const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { queryAsync, saveAvatarFile } = require('./common')

const secretKey = 'my_secret_key'

// 用户列表
router.get('/', async (req, res) => {
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

// 更新用户状态
router.put('/:id/status', async (req, res) => {
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

// 注册
router.post('/register', async (req, res) => {
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

// 登录
router.post('/login', async (req, res) => {
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
    const token = 'Bearer ' + jwt.sign({ username: req.body.username }, secretKey, { expiresIn: '2h' })
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar || '', token })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
})

// 获取用户详情
router.get('/:id', async (req, res) => {
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

// 更新用户信息
router.put('/:id', async (req, res) => {
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

// 修改密码
router.put('/:id/password', async (req, res) => {
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

module.exports = router
