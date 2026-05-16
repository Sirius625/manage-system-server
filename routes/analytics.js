/**
 * 数据分析 & 仪表盘路由
 * 
 * 提供仪表盘统计数据、销售趋势分析、商品分类占比等功能。
 * 
 * @module routes/analytics
 */

const express = require('express')
const router = express.Router()
const { queryAsync } = require('./common')

/**
 * 获取仪表盘统计数据
 * GET /api/dashboard/stats
 * 
 * @returns {object} totalOrders - 总订单数
 * @returns {number} totalRevenue - 总营收
 * @returns {number} activeUsers - 活跃用户数
 * @returns {number} pendingShipments - 待发货订单数
 */
router.get('/stats', async (req, res) => {
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

// 数据分析
router.get('/', async (req, res) => {
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
