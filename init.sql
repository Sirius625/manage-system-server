CREATE DATABASE IF NOT EXISTS management_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE management_system;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  avatar VARCHAR(255) DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT '正常',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'avatar'
);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT ""', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS products (
  id INT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT '在售',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INT PRIMARY KEY,
  customer VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT '待发货',
  address VARCHAR(255) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  order_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS after_sales (
  id INT PRIMARY KEY,
  order_id INT NOT NULL,
  `user` VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT '待处理',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

INSERT IGNORE INTO users (id, name, password, email, role, status) VALUES
(3001, 'admin', '$2b$10$5wzd/o4.lE7xiVl7J0H7puDUtGER8nOJro8FRY5m5a0XaDqg.Qk86', 'admin@example.com', '管理员', '正常'),
(3002, 'editor', '$2b$10$YeJVI5yk/K.Hvfy90g/5D.TvYw1Kvnv68QfP9pIWlaUotokyvKy8C', 'editor@example.com', '编辑员', '正常'),
(3003, '王小明', '$2b$10$MxsSTLvfl8CLNquST5A3CeN5xgxg/xV.3LJ7cGLGpA8UCfF.8GWDq', 'wang@example.com', '普通用户', '正常'),
(3004, '张婷婷', '$2b$10$alHc69KNb9nziuQFKo3YfuMVWQvUnXeQWYbdZouNn6XtB2WlBA2CW', 'zhang@example.com', '普通用户', '冻结'),
(3005, '李大锤', '$2b$10$Q/1ga2qMzF2ydICzyZsH/.lTYZShdnxCdP/OAp0qQ4tkyR0iiOGOG', 'li@example.com', 'VIP', '正常');

INSERT IGNORE INTO products (id, name, category, stock, price, status) VALUES
(2001, '无线鼠标', '外设', 120, 99.00, '在售'),
(2002, '机械键盘', '外设', 58, 329.00, '在售'),
(2003, '27寸显示器', '显示器', 32, 1299.00, '在售'),
(2004, '办公椅', '家具', 16, 499.00, '下架'),
(2005, '蓝牙音箱', '音频', 84, 239.00, '在售');

INSERT IGNORE INTO orders (id, customer, amount, status, address, phone, order_date) VALUES
(1001, '王小明', 320.00, '待发货', '北京市朝阳区建国路 88 号', '13800001234', '2026-04-20'),
(1002, '张婷婷', 158.00, '已完成', '上海市浦东新区世纪大道 1 号', '13900004567', '2026-04-21'),
(1003, '李大锤', 520.00, '待支付', '广州市天河区体育东路 10 号', '13700003456', '2026-04-22'),
(1004, '陈丽', 240.00, '已完成', '深圳市南山区科技园 100 号', '13600007890', '2026-04-23'),
(1005, '赵磊', 680.00, '待发货', '成都市高新区天府大道 200 号', '13500001234', '2026-04-24');

INSERT IGNORE INTO order_items (order_id, name, qty, price) VALUES
(1001, '无线鼠标', 1, 99.00),
(1001, '机械键盘', 1, 221.00),
(1002, '蓝牙音箱', 2, 79.00),
(1003, '27寸显示器', 1, 520.00),
(1004, '办公椅', 1, 240.00),
(1005, '无线鼠标', 1, 99.00),
(1005, '蓝牙音箱', 1, 239.00);

INSERT IGNORE INTO after_sales (id, order_id, `user`, type, reason, status) VALUES
(4001, 1001, '王小明', '退货', '商品损坏', '待处理'),
(4002, 1002, '张婷婷', '换货', '尺寸不合适', '处理中'),
(4003, 1003, '李大锤', '咨询', '配送询问', '已完成');
