const express = require('express')
const router = express.Router()
const { queryAsync } = require('./common')

// ==================== 健康检查 ====================
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

// ==================== 模块路由 ====================
router.use('/dashboard', require('./analytics'))
router.use('/orders', require('./orders'))
router.use('/products', require('./products'))
router.use('/users', require('./users'))
router.use('/after-sales', require('./after-sales'))
router.use('/analytics', require('./analytics'))
router.use('/songs', require('./songs'))
router.use('/history', require('./history'))
router.use('/images', require('./images'))
router.use('/articles', require('./articles'))

// ==================== 认证路由 ====================

router.use('/auth', require('./users'))

module.exports = router
