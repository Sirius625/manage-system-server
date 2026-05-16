CREATE DATABASE IF NOT EXISTS management_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE management_system;

-- 检查并创建 liked_songs 表
CREATE TABLE IF NOT EXISTS liked_songs (
  id BIGINT UNSIGNED NOT NULL COMMENT '歌曲ID',
  name VARCHAR(255) NOT NULL COMMENT '歌曲名称',
  ar JSON NOT NULL COMMENT '艺术家列表, 格式: [{"name": "Artist Name"}]',
  al JSON DEFAULT NULL COMMENT '专辑信息, 格式: {"picUrl": "...", "name": "..."}',
  dt INT UNSIGNED NOT NULL COMMENT '歌曲时长(毫秒)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  user_id INT UNSIGNED NOT NULL COMMENT '用户ID',
  play_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '播放次数',
  PRIMARY KEY (id, user_id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户喜欢的歌曲列表';

-- 检查并创建 history_songs 表
CREATE TABLE IF NOT EXISTS history_songs (
  id BIGINT UNSIGNED NOT NULL COMMENT '歌曲ID',
  name VARCHAR(255) NOT NULL COMMENT '歌曲名称',
  ar JSON NOT NULL COMMENT '艺术家列表, 格式: [{"name": "Artist Name"}]',
  al JSON DEFAULT NULL COMMENT '专辑信息, 格式: {"picUrl": "...", "name": "..."}',
  dt INT UNSIGNED NOT NULL COMMENT '歌曲时长(毫秒)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
  user_id INT UNSIGNED NOT NULL COMMENT '用户ID',
  play_count INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '播放次数',
  PRIMARY KEY (id, user_id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户播放历史歌曲列表';


CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  avatar VARCHAR(255) DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT '正常',
  remark VARCHAR(255) DEFAULT '',
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

-- 图片管理表
CREATE TABLE IF NOT EXISTS images (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL COMMENT '图片标题',
  description TEXT DEFAULT NULL COMMENT '图片描述',
  category VARCHAR(50) DEFAULT '其他' COMMENT '分类：运动/日常/游戏/其他',
  url VARCHAR(500) NOT NULL COMMENT '图片访问URL',
  path VARCHAR(500) NOT NULL COMMENT '图片存储路径',
  author VARCHAR(100) DEFAULT '' COMMENT '上传者',
  likes INT DEFAULT 0 COMMENT '点赞数',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图片管理表';

-- 为 images 表添加 category 字段（如果表已存在）
SET @category_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'images'
    AND COLUMN_NAME = 'category'
);
SET @sql2 = IF(@category_exists = 0, 'ALTER TABLE images ADD COLUMN category VARCHAR(50) DEFAULT "其他" COMMENT "分类：运动/日常/游戏/其他"', 'SELECT 1');
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 为 images 表添加 user_id 字段（如果表已存在）
SET @user_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'images'
    AND COLUMN_NAME = 'user_id'
);
SET @sql3 = IF(@user_id_exists = 0, 'ALTER TABLE images ADD COLUMN user_id INT DEFAULT NULL COMMENT "上传用户ID"', 'SELECT 1');
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 博客文章表
CREATE TABLE IF NOT EXISTS articles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL COMMENT '文章标题',
  content TEXT NOT NULL COMMENT '文章内容（Markdown）',
  summary VARCHAR(500) DEFAULT '' COMMENT '文章摘要',
  category VARCHAR(50) DEFAULT '未分类' COMMENT '文章分类',
  tags JSON DEFAULT NULL COMMENT '标签列表',
  cover VARCHAR(500) DEFAULT '' COMMENT '封面图片URL',
  author VARCHAR(100) DEFAULT '匿名' COMMENT '作者',
  likes INT DEFAULT 0 COMMENT '点赞数',
  views INT DEFAULT 0 COMMENT '浏览量',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='博客文章表';

-- 为 images 表添加 is_public 字段（如果表已存在）

SET @is_public_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'images'
    AND COLUMN_NAME = 'is_public'
);
SET @sql4 = IF(@is_public_exists = 0, 'ALTER TABLE images ADD COLUMN is_public TINYINT(1) DEFAULT 1 COMMENT "是否公开：1公开 0私密"', 'SELECT 1');
PREPARE stmt4 FROM @sql4;
EXECUTE stmt4;
DEALLOCATE PREPARE stmt4;


