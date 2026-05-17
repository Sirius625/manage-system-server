/**
 * 歌曲管理路由
 * 
 * 提供喜欢的歌曲列表查询、喜欢/取消喜欢、播放记录同步等功能。
 * 
 * @module routes/songs
 */

const express = require('express')
const router = express.Router()
const { queryAsync, getUserIdFromToken } = require('./common')

/**
 * 获取喜欢的歌曲列表（分页）
 * GET /api/songs
 * 
 * @query {number} page - 页码（默认1）
 * @query {number} pageSize - 每页条数（默认10）
 * @query {string} keyword - 搜索关键词（按歌曲名或歌手名）
 */
router.get('/', async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 10
  const { keyword } = req.query
  const userId = await getUserIdFromToken(req)

  if (!userId) {
    return res.json({ code: 200, data: [], total: 0, page, pageSize })
  }

  const offset = (page - 1) * pageSize
  let sql = 'SELECT * FROM liked_songs'
  const conditions = ['user_id = ?']
  const values = [userId]

  try {
    if (keyword) {
      const isNumeric = /^\d+$/.test(keyword)
      if (isNumeric) {
        conditions.push('id = ?')
        values.push(keyword)
      } else {
        conditions.push('(name LIKE ? OR (JSON_LENGTH(ar) > 0 AND JSON_EXTRACT(ar, "$[0].name") LIKE ?))')
        const likeParam = `%${keyword}%`
        values.push(likeParam, likeParam)
      }
    }

    sql += ' WHERE ' + conditions.join(' AND ')

    const countSql = 'SELECT COUNT(*) as total FROM liked_songs WHERE ' + conditions.join(' AND ')
    const countResult = await queryAsync(countSql, values)
    const total = countResult[0]?.total

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    values.push(pageSize, offset)

    const rows = await queryAsync(sql, values)

    res.json({
      code: 200,
      data: rows,
      total,
      page,
      pageSize
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: 'Server Error' })
  }
})

// 新增/取消喜欢歌曲
router.post('/', async (req, res) => {
  const { id, name, ar, al, dt } = req.body
  const userId = await getUserIdFromToken(req)

  if (!userId) {
    return res.status(401).json({ code: 401, message: '未授权，请先登录' })
  }

  if (!id) {
    return res.status(400).json({ code: 400, message: '缺少必要参数: id' })
  }

  try {
    const checkSql = 'SELECT id FROM liked_songs WHERE id = ? AND user_id = ?'
    const existing = await queryAsync(checkSql, [id, userId])

    if (existing && existing.length > 0) {
      const deleteSql = 'DELETE FROM liked_songs WHERE id = ?'
      await queryAsync(deleteSql, [id])
      return res.json({ code: 200, message: '已取消喜欢', action: 'deleted' })
    } else {
      const artistJson = Array.isArray(ar) ? JSON.stringify(ar) : ar
      const albumJson = al ? (typeof al === 'object' ? JSON.stringify(al) : al) : null

      const insertSql = 'INSERT INTO liked_songs (id, name, ar, al, dt, user_id, play_count) VALUES (?, ?, ?, ?, ?, ?, 0)'
      await queryAsync(insertSql, [id, name, artistJson, albumJson, dt, userId])

      return res.json({ code: 200, message: '已添加喜欢', action: 'added' })
    }
  } catch (error) {
    console.error('操作失败:', error)
    res.status(500).json({ code: 500, message: '服务器内部错误', error: error.message })
  }
})

// 记录播放并同步更新播放次数
router.post('/play-sync/:songId', async (req, res) => {
  const { songId } = req.params
  const userId = await getUserIdFromToken(req)

  if (!userId) {
    // 未登录用户不记录播放次数，但不返回 401（避免前端清除登录状态）
    return res.json({ code: 200, message: '游客模式，不记录播放次数', action: 'skipped' })
  }

  const { name, ar, al, dt } = req.body

  try {
    // 处理播放历史
    const checkHistorySql = 'SELECT id, play_count FROM history_songs WHERE id = ? AND user_id = ?'
    const historyRecord = await queryAsync(checkHistorySql, [songId, userId])

    if (historyRecord && historyRecord.length > 0) {
      const newPlayCount = (historyRecord[0].play_count || 0) + 1
      const updateHistorySql = 'UPDATE history_songs SET play_count = ?, created_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?'
      await queryAsync(updateHistorySql, [newPlayCount, songId, userId])
    } else {
      const artistJson = Array.isArray(ar) ? JSON.stringify(ar) : ar
      const albumJson = al ? (typeof al === 'object' ? JSON.stringify(al) : al) : null

      const insertHistorySql = `
        INSERT INTO history_songs (id, name, ar, al, dt, user_id, play_count) 
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `
      await queryAsync(insertHistorySql, [songId, name, artistJson, albumJson, dt, userId])
    }

    // 处理喜欢歌曲的播放次数
    const checkLikedSql = 'SELECT id, play_count FROM liked_songs WHERE id = ? AND user_id = ?'
    const likedRecord = await queryAsync(checkLikedSql, [songId, userId])

    if (likedRecord && likedRecord.length > 0) {
      const newLikedPlayCount = (likedRecord[0].play_count || 0) + 1
      const updateLikedSql = 'UPDATE liked_songs SET play_count = ? WHERE id = ? AND user_id = ?'
      await queryAsync(updateLikedSql, [newLikedPlayCount, songId, userId])
    }

    return res.json({ code: 200, message: '播放记录同步成功' })
  } catch (error) {
    console.error('同步播放计数失败:', error)
    res.status(500).json({ code: 500, message: '服务器内部错误', error: error.message })
  }
})

module.exports = router
