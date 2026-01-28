# Elysia 后端

该目录包含应用的 Elysia.js 后端入口与相关逻辑。

## 约束

- 仅后端进程负责数据库读写（通过 `src/LeavelDB` 封装）
- 主进程通过 stdio 接收后端发来的控制消息（例如创建窗口、退出应用）
- 渲染进程只通过 HTTP API 调用后端（不直接访问 DB、不直接控制主进程）

## 运行时环境变量

- `LANSTART_BACKEND_PORT`：后端监听端口（默认 3131）
- `LANSTART_DB_PATH`：LevelDB 数据目录

## HTTP API

- `GET /health`
- `GET/PUT/DELETE /kv/:key`
- `POST /commands`
- `GET /events`

