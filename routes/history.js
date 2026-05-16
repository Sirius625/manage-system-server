const express = require('express')
const router = express.Router()
const { queryAsync, getUserIdFromToken } = require('./common')

// 添加播放历史
router.post('/', async (req, res) => {
  const { id, name, ar, al, dt } = req.body
  const userId = await getUserIdFromToken(req)

  if (!userId) {
    // 未登录用户不记录历史，但不返回 401（避免前端清除登录状态）
    return res.json({ code: 200, message: '游客模式，不记录播放历史', action: 'skipped' })
  }

  if (!id || !name || !dt) {
    return res.status(400).json({ code: 400, message: '缺少必要参数: id, name, dt' })
  }

  try {
    const checkSql = 'SELECT id, play_count FROM history_songs WHERE id = ? AND user_id = ?'
    const existing = await queryAsync(checkSql, [id, userId])

    if (existing && existing.length > 0) {
      const newPlayCount = existing[0].play_count + 1
      const updateSql = 'UPDATE history_songs SET created_at = CURRENT_TIMESTAMP, play_count = ? WHERE id = ? AND user_id = ?'
      await queryAsync(updateSql, [newPlayCount, id, userId])
      return res.json({ code: 200, message: '播放历史已更新', action: 'updated', play_count: newPlayCount })
    } else {
      const artistJson = Array.isArray(ar) ? JSON.stringify(ar) : ar
      const albumJson = al ? (typeof al === 'object' ? JSON.stringify(al) : al) : null

      const insertSql = `INSERT INTO history_songs (id, name, ar, al, dt, user_id, play_count, created_at) 
                         VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`
      await queryAsync(insertSql, [id, name, artistJson, albumJson, dt, userId])

      return res.json({ code: 200, message: '已添加播放历史', action: 'added' })
    }
  } catch (error) {
    console.error('添加播放历史失败:', error)
    res.status(500).json({ code: 500, message: '服务器内部错误', error: error.message })
  }
})

// 获取播放历史
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 50
  const { keyword } = req.query
  const userId = await getUserIdFromToken(req)

  if (!userId) {
    return res.json({ code: 200, data: [], total: 0, page, pageSize })
  }

  const offset = (page - 1) * pageSize
  const conditions = ['user_id = ?']
  const values = [userId]

  try {
    if (keyword) {
      const isNumeric = /^\d+$/.test(keyword)
      if (isNumeric) {
        conditions.push('id = ?')
        values.push(keyword)
      } else {
        conditions.push('(name LIKE ? OR JSON_SEARCH(ar, "one", ?) IS NOT NULL)')
        const likeParam = `%${keyword}%`
        values.push(likeParam, likeParam)
      }
    }

    const whereClause = 'WHERE ' + conditions.join(' AND ')

    const countSql = `SELECT COUNT(*) as total FROM history_songs ${whereClause}`
    const countResult = await queryAsync(countSql, values)
    const total = countResult[0]?.total || 0

    const listSql = `SELECT * FROM history_songs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    const listValues = [...values, pageSize, offset]
    const rows = await queryAsync(listSql, listValues)

    const formattedRows = rows.map(row => {
      return {
        ...row,
        ar: typeof row.ar === 'string' ? JSON.parse(row.ar) : row.ar,
        al: typeof row.al === 'string' ? JSON.parse(row.al) : row.al
      }
    })

    res.json({
      code: 200,
      data: formattedRows,
      total,
      page,
      pageSize
    })
  } catch (error) {
    console.error('查询播放历史失败:', error)
    res.status(500).json({ code: 500, message: '服务器内部错误', error: error.message })
  }
})

// 清空播放历史
router.delete('/clear', async (req, res) => {
  const userId = await getUserIdFromToken(req)

  if (!userId) {
    return res.status(401).json({ code: 401, message: '未授权，请先登录' })
  }

  try {
    const deleteSql = 'DELETE FROM history_songs WHERE user_id = ?'
    const result = await queryAsync(deleteSql, [userId])
    const deletedCount = result.affectedRows || 0

    if (deletedCount > 0) {
      return res.json({
        code: 200,
        message: '播放历史已清空',
        data: { deletedCount }
      })
    } else {
      return res.json({
        code: 200,
        message: '没有可清空的记录',
        data: { deletedCount: 0 }
      })
    }
  } catch (error) {
    console.error('清空播放历史失败:', error)
    res.status(500).json({
      code: 500,
      message: '服务器内部错误',
      error: error.message
    })
  }
})

module.exports = router
