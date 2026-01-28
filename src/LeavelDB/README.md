# LeavelDB

该目录封装对 LevelDB（`level` 包）的访问层，供后端（Elysia）统一调用。

## 约束

- 仅后端进程负责 DB 读写；渲染进程通过后端 HTTP API 间接访问
- DB 路径由主进程注入环境变量 `LANSTART_DB_PATH`，后端负责打开 DB

## API

- `openLeavelDb(dbPath)`：打开数据库实例
- `getValue(db, key)`：读取
- `putValue(db, key, value)`：写入
- `deleteValue(db, key)`：删除

