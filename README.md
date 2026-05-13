# 后台管理系统 - 后端 (Manage System Server)

一个基于 Node.js + Express + MySQL 的企业级后台管理系统后端服务。

## 技术栈

- **运行环境**: Node.js
- **框架**: Express
- **数据库**: MySQL
- **认证**: JWT (JSON Web Token)
- **密码加密**: bcryptjs
- **中间件**: cors, body-parser, express-jwt

## 功能模块

### 🔐 认证模块
- `POST /api/auth/login` - 用户登录（返回 JWT Token）
- `POST /api/auth/register` - 用户注册

### 📊 仪表盘
- `GET /api/dashboard/stats` - 获取统计数据（订单数、营收、活跃用户、待发货）

### 📦 订单管理
- `GET /api/orders` - 订单列表（分页、关键词、状态筛选）
- `GET /api/orders/:id` - 订单详情（含商品明细）
- `PUT /api/orders/:id/status` - 更新订单状态
- `POST /api/orders/batch-update` - 批量更新订单状态

### 🏷️ 商品管理
- `GET /api/products` - 商品列表（分页、关键词、分类筛选）
- `GET /api/products/:id` - 商品详情
- `POST /api/products` - 新增商品
- `PUT /api/products/:id/stock` - 更新商品库存
- `POST /api/products/batch-update` - 批量更新商品状态

### 👥 用户管理
- `GET /api/users` - 用户列表（分页、关键词、角色、状态筛选）
- `GET /api/users/:id` - 用户详情
- `PUT /api/users/:id` - 更新用户信息（含头像上传）
- `PUT /api/users/:id/status` - 更新用户状态
- `PUT /api/users/:id/password` - 修改密码

### 🎵 歌曲管理
- `GET /api/songs` - 歌曲列表（分页、搜索）
- `POST /api/songs` - 喜欢/取消喜欢歌曲（自动切换）
- `POST /api/songs/play-sync/:songId` - 同步播放记录

### 📜 播放历史
- `GET /api/history` - 播放历史列表（分页、搜索）
- `POST /api/history` - 添加播放历史
- `DELETE /api/history/clear` - 清空播放历史

### 🔄 售后管理
- `GET /api/after-sales` - 售后记录列表（分页、关键词、状态筛选）
- `PUT /api/after-sales/:id/status` - 更新售后状态

### 📈 数据分析
- `GET /api/analytics` - 获取销售趋势和商品分类占比数据

### 🩺 健康检查
- `GET /api/status` - 数据库连接状态检查

## 快速开始

### 前置要求

- Node.js >= 16
- MySQL >= 5.7

### 安装与运行

```bash
# 安装依赖
npm install

# 初始化数据库（执行 SQL 脚本）
mysql -u root -p < init.sql

# 启动服务
npm start

# 开发模式（热重载）
npm run dev
```

## 环境变量

在 `.env` 中配置：

```env
PORT=3030
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=management_system
```

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `users` | 用户表（含头像、角色、状态） |
| `products` | 商品表 |
| `orders` | 订单表 |
| `order_items` | 订单明细表 |
| `after_sales` | 售后记录表 |
| `liked_songs` | 喜欢的歌曲表 |
| `history_songs` | 播放历史表 |

## 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| editor | editor123 | 编辑员 |
