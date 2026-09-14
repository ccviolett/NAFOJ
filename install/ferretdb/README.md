# NAFOJ 多数据库后端支持（mongodb / postgres / sqlite）

本仓库（基于 Hydro 二开）在保留 MongoDB 全量支持的同时，新增两种存储后端：

| `db.mode`   | 实际存储                        | 外部依赖                     | 适用场景 |
|-------------|---------------------------------|------------------------------|----------|
| `mongodb`   | MongoDB 服务器（原版行为）       | MongoDB                      | 生产 / 原有部署 |
| `postgres`  | PostgreSQL（经 FerretDB 翻译）   | PostgreSQL + ferretdb 二进制 | 想统一到 PG 技术栈 |
| `sqlite`    | SQLite 文件（经 FerretDB 翻译）  | 仅 ferretdb 二进制           | 单机 / 开发 / 嵌入式 |

原理：Hydro 全部业务代码继续讲 MongoDB 协议；`postgres`/`sqlite` 模式下，
`packages/hydrooj/src/service/db-sidecar.ts` 会在 `MongoClient.connect` 之前自动
拉起本地 FerretDB sidecar（默认监听 `127.0.0.1:27018`），由它把 MongoDB 查询
翻译成 SQL。业务代码零改动，三种模式同一套代码。

## 1. 安装 FerretDB 二进制（一次性）

需要 Go 1.22+。注意：**不能直接 `go install`**——module 方式安装不生成版本文件，
二进制启动即 panic。请使用本目录的脚本（内部逻辑：clone tag → 写入
`build/version/version.txt` → `go build`）：

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File install/ferretdb/build.ps1
```

```bash
# Linux / macOS
./install/ferretdb/build.sh
```

二进制查找顺序：`FERRETDB_BIN` → 配置 `ferretdbBin` → `~/.hydro/bin/ferretdb(.exe)` → `$GOPATH/bin/ferretdb(.exe)`。

## 2. 切换模式

在 `~/.hydro/config.json` 里加一个字段即可（或用 profile 隔离）：

**sqlite 模式（推荐先试这个，零外部服务）：**

```json
{
    "mode": "sqlite",
    "name": "hydro"
}
```

数据落在 `~/.hydro/sqlite/`（可用 `sqliteDir` 改路径）。

**postgres 模式：**

```json
{
    "mode": "postgres",
    "name": "hydro",
    "postgresqlUrl": "postgres://ferretdb:ferretdb@127.0.0.1:5432/ferretdb?search_path=hydro"
}
```

本地没有 PostgreSQL 时可用 compose 起一个：
`docker compose -f install/ferretdb/docker-compose.yml up -d`

**mongodb 模式：** 不写 `mode` 字段，行为与上游 Hydro 完全一致。

也可以用环境变量 `HYDRO_DB_MODE=sqlite|postgres|mongodb` 覆盖配置文件（适合临时
切换）；`FERRETDB_SQLITE_DIR`、`FERRETDB_POSTGRESQL_URL`、`FERRETDB_HOST`、
`FERRETDB_PORT`、`FERRETDB_BIN` 同理。

## 3. 配置项一览

| 键（config.json） | 环境变量 | 默认 | 说明 |
|---|---|---|---|
| `mode` | `HYDRO_DB_MODE` | `mongodb` | 后端选择 |
| `ferretdbHost` / `ferretdbPort` | `FERRETDB_HOST` / `FERRETDB_PORT` | `127.0.0.1` / `27018` | sidecar 监听地址 |
| `sqliteDir` | `FERRETDB_SQLITE_DIR` | `~/.hydro/sqlite` | sqlite 数据目录 |
| `postgresqlUrl` | `FERRETDB_POSTGRESQL_URL` | `postgres://127.0.0.1:5432/ferretdb?search_path=hydro` | PG 连接串 |
| `ferretdbBin` | `FERRETDB_BIN` | 见查找顺序 | 二进制路径 |

端口已被占用（已有 sidecar 在跑）时 Hydro 直接复用，不会重复启动。
sidecar 日志在 `~/.hydro/ferretdb.log`。

## 4. 已知差异与限制（相对真 MongoDB）

- **FerretDB 版本**：使用 1.x 最终版 **v1.24.2**。FerretDB 2.x 只支持 PostgreSQL
  （依赖 DocumentDB 扩展）且移除了 SQLite 后端，故 sqlite 能力必须留在 1.x 线。
  1.x 已停止功能迭代，生产重负载场景建议 `mongodb` 模式。
- **change stream 不可用**：`model/task.ts` 的事件流会自动降级为 500ms 轮询
  （Hydro 原生自带该降级路径，非本仓库修改）。
- **TTL 索引**：FerretDB 不做服务端 TTL 清理；Hydro 每小时的 `fixExpireAfter`
  补偿任务会兜底（也是原有机制）。
- **文本索引创建会失败**：`document` 集合的 text 索引建不起来，只产生一条错误
  日志；Hydro 实际搜索走 sonic/es，无功能影响。
- **`$lookup`/`$expr`**（domain 用户列表）与 PCRE `\A` 前缀正则在 FerretDB 上
  语义可能有细微差别，升级 FerretDB 或迁移数据前建议针对这两处做回归。
- `hydrooj db shell/backup/restore` 仍调用 mongosh/mongodump，指向的是 sidecar
  端口，工具本身仍需单独安装。

## 5. 代码位置

- `packages/hydrooj/src/service/db-sidecar.ts` — 模式解析、URL 构建、sidecar 拉起与就绪等待
- `packages/hydrooj/src/service/db.ts` — `getUrl()` / `Service.init()` 接入点
- `packages/hydrooj/src/commands/db.ts` — CLI（db shell / backup / restore）复用同一 URL 构建
