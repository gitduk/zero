# 树洞网站

一个匿名分享想法和感受的网站，基于 Axum 和 PostgreSQL 构建。

## 特性

- 无需登录，完全匿名
- 简洁的 UI 界面
- 支持发帖和评论
- 响应式设计，支持移动设备

## 技术栈

- **后端**：Rust + Axum
- **数据库**：PostgreSQL
- **前端**：HTML + CSS + JavaScript (Bootstrap 5)

## 开发环境准备

1. 安装 Rust 和 Cargo
2. 安装 PostgreSQL
3. 克隆项目

## 配置与运行

1. 创建 `.env` 文件（参考 `.env.example`）:

```
DATABASE_URL=postgres://用户名:密码@localhost:5432/数据库名
SERVER_ADDR=127.0.0.1:3000
RUST_LOG=info
```

2. 创建数据库:

```bash
psql -U postgres
CREATE DATABASE treehouse;
```

3. 运行项目:

```bash
cargo run
```

4. 访问网站：浏览器打开 `http://localhost:3000`

## 项目结构

```
.
├── src
│   ├── models       # 数据模型
│   ├── routes       # API 路由处理
│   ├── schema       # 数据结构定义
│   ├── utils        # 工具函数
│   └── main.rs      # 程序入口
├── migrations       # 数据库迁移文件
├── static           # 静态文件
└── .env.example     # 环境变量模板
```

## API 接口

- `GET /api/posts` - 获取帖子列表
- `POST /api/posts` - 创建新帖子
- `GET /api/posts/:id` - 获取单个帖子详情
- `GET /api/posts/:id/comments` - 获取帖子评论
- `POST /api/posts/:id/comments` - 添加帖子评论

## 许可证

MIT