require('dotenv').config()
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
const { expressjwt } = require('express-jwt');

const app = express()
const port = process.env.PORT || 3030
const apiRouter = require('./routes/api')
const { pool, initDatabase, hashLegacyPasswords } = require('./db')

app.use(cors())
app.use(bodyParser.json({ limit: '10mb' }))
app.use(bodyParser.urlencoded({ extended: true }))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
const secretKey = 'my_secret_key'
app.use(
  expressjwt({
    secret: secretKey,
    algorithms: ['HS256'],
    requestProperty: 'user' 
}).unless({
  path: [
    '/api/auth/login',
    '/api/songs','/api/history', 
    '/api/history/clear', 
    { url: /^\/api\/songs/} 
  ] 
}))
app.get('/', (req, res) => {
  res.json({ message: 'Project server is running.' })
})

app.use('/api', apiRouter)

initDatabase()
  .then(() => hashLegacyPasswords())
  .then(() => {
    console.log('Database initialized and passwords verified successfully.')
    pool.getConnection((err, connection) => {
      if (err) {
        console.error('MySQL connection failed:', err.message)
      } else {
        console.log('MySQL connected successfully.')
        connection.release()
      }
    })
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`)
    })
  })
  .catch((err) => {
    console.error('Database initialization failed:', err.message || err)
    process.exit(1)
  })
