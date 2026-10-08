# 本站改动记录与操作手册

> 这份文档记录的是**这个仓库自己的改动**（不是框架上游的文档）。上游的框架文档在 `docs/` 的其他文件里。
> 对应的提交：`dev` 分支的 `406f2c8`「优化」（48 个文件，+4028 行）。`main` 保持上游原样，方便随时对比与合并。

---

## 0. 一页速查

### 现在多了什么

| 功能 | 位置 | 状态 |
|---|---|---|
| **AIHOT 内容镜像**（精选条目 + 撤选 + 热点事件 + 日报周报月报） | `modules/aihot-bridge/`（19 个文件） | 已开（`AIHOT_BRIDGE_ENABLED=true`） |
| **自建模型榜**（评测名次 + 领域分数 + 上线日期 + 价格） | `modules/leaderboard/`（21 个文件） | 已开（每天 06:10 刷新） |
| **引擎插口：导入外部已定事件** | `packages/backend/src/events/import.ts`（143 行） | 被上面第一个模块调用 |
| 注册与配置 | `site/modules/*.ts`、`site/package.json`、`Dockerfile`、`.env.example` | — |

### 现在的运行状态（本机）

| 东西 | 值 | 是否持久 |
|---|---|---|
| 网站 | <http://localhost:3000>（后台 `/admin`） | 进程 |
| api | `127.0.0.1:3001` | 进程 |
| worker | 无端口（跑 5 条我们的排程 + 框架排程） | 进程 |
| 数据库 | `postgres://postgres@127.0.0.1:5433/myhot` | ⚠️ 数据在 `/tmp/pgdata`，**重启机器或清理 /tmp 就没了** |
| Node 运行时 | `/tmp/n24/current/bin/node`（v24.21.0） | ⚠️ 同样在 `/tmp`，**是临时的** |
| 密钥与管理员密码 | 仓库根目录 `.env`（已被 `.gitignore` 忽略） | 文件 |

⚠️ 两处 `/tmp` 是这次为了在本机跑起来临时造的。**要长期使用，先做第 4 节的两件事**：换一个正式的 Postgres、装一个正式的 Node 24。

### 常用命令

```bash
export PATH=/tmp/n24/current/bin:$PATH      # 本机 Node 24（或装了正式的 Node 24 就不用这句）
cd /Users/a1/Documents/luoer/AIHOT

# 数据库（临时集群）
LC_ALL=C pg_ctl -D /tmp/pgdata -o "-p 5433 -k /tmp/pgsock -l /tmp/pg.log" start
LC_ALL=C pg_ctl -D /tmp/pgdata stop

# 迁移（含模块自带的迁移）
npm run db:migrate

# 三个进程
node --env-file-if-exists=.env apps/api/src/main.ts
node --env-file-if-exists=.env apps/worker/src/main.ts
npm run dev -w @aihot/web                   # 网站 :3000

# 手动同步（不用等排程）
node --env-file-if-exists=.env modules/aihot-bridge/scripts/sync.ts all      # items|changes|events|reports
node --env-file-if-exists=.env modules/leaderboard/scripts/sync.ts

# 检查
npm run typecheck
DATABASE_URL=postgres://postgres@127.0.0.1:5433/aihot_test npm test          # 库名必须以 _test 结尾
npm run test:standalone
```

---

## 1. 改动的完整清单

### 1.1 新增模块：`modules/aihot-bridge/` —— 把 AIHOT 的成品搬进来

| 文件 | 作用 |
|---|---|
| `config.ts` | 全部开关与参数（唯一读取 `AIHOT_BRIDGE_ENABLED`、`AIHOT_BRIDGE_BASE_URL` 的地方） |
| `server.ts` | 4 条排程 + 告警 |
| `backend/client.ts` | 对 AIHOT 公开 API 的 HTTP 客户端：单请求串行、1.2 秒间隔、ETag、429 按 `Retry-After` 等 |
| `backend/types.ts` | AIHOT 接口的响应类型（items / snapshot / changes / stories / dailies…） |
| `backend/mapping.ts` | 纯映射：条目 → 框架的分析字段；日报周报月报 → 框架的报告结构 |
| `backend/import.ts` | 落库：`upsertMaterial` 落料 → 写 `analyses` → 调公开层 `publishArticle` |
| `backend/events.ts` | 热点榜与事件：拉 hot-topics + 事件详情，交给引擎插口 |
| `backend/sync.ts` | 三路同步的编排（条目 / 撤选台账 / 报告） |
| `backend/state.ts` | 自己两张表的读写 |
| `backend/summary.ts` | 每路同步的统计结构 |
| `backend/status.ts` | 给后台与告警看的状态 |
| `migrations/0100_aihot_bridge_items.sql` | 导入映射表（AIHOT 条目 id ↔ 本站文章 id、payload 哈希、是否本模块所有） |
| `migrations/0101_aihot_bridge_sync.sql` | 每路同步的游标/ETag/上次结果 |
| `scripts/sync.ts` | 手动同步 CLI |
| `tests/` | 3 个测试文件（映射纯函数 + 导入 + 事件） |
| `README.md` | 模块说明（含合规前置条件） |

**它写入的框架表**：`articles`、`analyses`（`origin='replay'`）、`sources`、`reports`（`origin='imported'`），以及通过插口写 `stories`/`facts`/`fact_articles`/`story_signals`/`story_digests`。
**它绝不调用模型**：判断是随条目拿到的，条目进来时 `processing_state` 直接是 `analyzed`。

### 1.2 新增模块：`modules/leaderboard/` —— 自建模型榜

| 文件 | 作用 |
|---|---|
| `config.ts` | 数据源开关、行的数量、主榜来源、能力列顺序、模型名匹配的手工例外 |
| `module.ts` / `server.ts` / `web.tsx` | 地址（`/leaderboard`、`/api/leaderboard`）、后端（接口 + 每天同步 + 告警）、侧栏导航项 |
| `backend/sources.ts` | 三个适配器：LiveBench 官方表格 CSV、OpenRouter 公开接口、你自己的 JSON |
| `backend/csv.ts` | CSV 解析、数字识别、模型 key 归一 |
| `backend/match.ts` | **基准模型 id ↔ 目录模型 id 的匹配规则**（错配会把价格挂到别的模型上，所以规则很窄） |
| `backend/import.ts` | 落库（目录行合并保留、成绩整批替换） |
| `backend/read.ts` | 读层：主榜（综合 + 各能力列）× 目录（上线/价格）的拼接 |
| `backend/sync.ts` | 一次跑遍所有来源，失败保留旧数据 |
| `format.ts` | 显示用：`claude-opus-5-5-max-effort` → `Claude Opus 5 5 Max Effort` |
| `migrations/0102_leaderboard_models.sql`、`0103_leaderboard_scores.sql`、`0104_leaderboard_sources.sql` | 模型目录 / 成绩 / 数据源三张表 |
| `web/leaderboard.tsx` | 页面本体 |
| `scripts/sync.ts` | 手动同步 CLI |
| `tests/` | 纯函数测试 + 数据库测试（含匹配） |
| `README.md` | 模块说明（数据源、JSON Schema、边界） |

### 1.3 引擎侧唯一改动：`packages/backend/src/events/import.ts`

**为什么必须放在引擎里**：`stories`、`facts`、`fact_articles`、`story_signals`、`story_digests` 这几张表按架构约定
只有 `events/` 目录能写（`tests/architecture.test.ts` 会强制检查），模块不能直接写。

它提供的是一个**通用插口**「导入一件别处已经定好的事件」，不认识 AIHOT：任何镜像、迁移或内部工具都能用。
它只写 `origin='replay'` 的事件，**本站自己归的事件（`origin='model'`）和编辑改过的（`'manual'`）一概不碰**。

### 1.4 注册与配置（5 个文件）

| 文件 | 改动 |
|---|---|
| `site/modules/index.ts` | 加一行：模块的地址声明（`leaderboard` 有页面，`aihot-bridge` 没有） |
| `site/modules/server.ts` | 加两行：两个模块的后端装进 api 与 worker |
| `site/modules/web.ts` | 加一行：模型榜的侧栏导航项 |
| `site/package.json` | `dependencies` 加 `@aihot/aihot-bridge`、`@aihot/leaderboard` |
| `Dockerfile` | 加两行 `COPY modules/<名字>/package.json …`（Docker 构建阶段要能装 workspace） |
| `.env.example` | 加 `AIHOT_BRIDGE_ENABLED`、`AIHOT_BRIDGE_BASE_URL`（框架的架构测试要求：代码读的环境变量必须在模板里） |
| `package-lock.json` | 新增两个 workspace 包后的锁文件更新 |

### 1.5 没有改动的部分

`apps/`（三个进程的壳）、`packages/contracts/`、`industry/`（行业包）、`site/` 的其他文件、框架的业务代码，**一行没动**。

---

## 2. 每个功能怎么关掉或删掉

| 想做什么 | 怎么做 | 留下的东西 |
|---|---|---|
| 暂停镜像同步 | `.env` 里 `AIHOT_BRIDGE_ENABLED=false`，重启 worker（排程会被移除） | 已导入的内容仍在站上 |
| 完全不装镜像 | 删 `site/modules/server.ts` 里那一行；再想干净点就删 `modules/aihot-bridge/` 与 `site/package.json`、`Dockerfile` 里的对应行 | 库里的表与数据（`aihot_bridge_*` 及导入的文章） |
| 暂停模型榜 | 删 `site/modules/{index,server,web}.ts` 里 `leaderboard` 那几行 | 库里的三张 `leaderboard_*` 表 |
| 只停某一个镜像数据源 | `modules/aihot-bridge/config.ts` 里改 `hotTopics.importMissingReports` 等；榜单则在 `modules/leaderboard/config.ts` 里把 `livebench`/`openrouter` 设 `enabled:false` | — |
| 换模型榜数据源 | `modules/leaderboard/config.ts` 的 `json` 字段（本地文件或 https），详见模块 README | — |
| 让引擎自己采集/分析 | `.env` 里打开 `COLLECT_ENABLED`、`MODEL_CALLS_ENABLED`（**这一步开始花模型的钱**，有预算熔断兜着） | — |

> 删功能时按仓库规矩（AGENTS.md）：同一个改动里把它的代码、测试、文档、迁移和存下的状态一起删掉。

---

## 3. 数据落库地图

### 镜像（aihot-bridge）

```
AIHOT 公开 API                    本站库
/api/v1/items ──精选条目──▶ articles + analyses(origin=replay) ──▶ publications(selected/seat) ──▶ 网页/RSS/API/MCP
/api/v1/selected/{snapshot,changes} ──撤选──▶ 新的 analyses 行(selected=false) ──▶ publications.selected=false（文章仍在"全部动态"）
/api/v1/hot-topics + /api/v1/stories/{id}
      └─▶ stories / facts / fact_articles / story_signals / story_digests ──▶ /hot 热点榜、/story/<uuid> 事件页
/api/v1/{dailies,weeklies,monthlies} ──▶ reports(origin=imported) ──▶ /daily /weekly /monthly 与 RSS
本模块自己的表：aihot_bridge_items（导入映射）、aihot_bridge_sync（游标与上次结果）
```

### 模型榜（leaderboard）

```
LiveBench 官方仓库的最新表格 CSV ──▶ leaderboard_scores（模型 × 任务，含 is_overall 标记）
OpenRouter 公开接口 /api/v1/models ──▶ leaderboard_models（上下文、价格、上线日期、模态）
你的 JSON（可选）────────────────▶ 上面两张表
读的时候：主榜 = 综合分排序 + 各能力类别均分 + 按模型名匹配来的日期与价格
三张表：leaderboard_models / leaderboard_scores / leaderboard_sources（每个来源的版本与错误）
```

---

## 4. 下次开始前，建议先做的两件事

这次为了在本机把它跑起来，用了两处临时设施。**它们随时会消失**：

1. **数据库是临时的**（`/tmp/pgdata`，281 MB，端口 5433）。
   换法：装一个正式 Postgres（或在一台有 Docker 的机器上用仓库自带的 `docker-compose.yml`），
   然后改 `.env` 的 `DATABASE_URL`，跑 `npm run db:migrate`，再重新同步一次内容。
2. **Node 是临时的**（`/tmp/n24`）。换法：装正式 Node 24（`nvm install 24` 或官网安装包），之后命令里不用再 `export PATH`。

另外，`.env` 里有这个部署的密钥与管理员密码（`ADMIN_PASSWORD`），它不进 Git，**换机器时要自己复制过去**。

---

## 5. 操作手册：常见改动怎么做

### A. 改站名、行业、分类、信源（框架自带的路）

按上游文档来，不需要动这次新增的任何代码：

1. `docs/customize.md`（顺序：`site/site.ts` → `industry/taxonomy.ts` / `topics.json` → `industry/sources.json` → `industry/prompts/` → `industry/selection.ts`）
2. 改完跑第 6 节的检查命令

⚠️ 注意：分类 key 改了以后，**镜像内容里的分类还是 AIHOT 的分类**（`ai-*`）。
要么保留这些分类，要么在 `modules/aihot-bridge/config.ts` 的 `categoryMap` 里把它们映到你的 key。

### B. 调镜像的行为

| 想改什么 | 改哪里 |
|---|---|
| 拉多少、窗口多大 | `modules/aihot-bridge/config.ts`：`itemsWindow`、`maxItemsPerRun`、`pageLimit` |
| 事件与热点 | 同上：`hotTopics.{top,maxReportsPerEvent,importMissingReports}` |
| 报告保留几期 | 同上：`reportHistory` |
| 分类映射、来源分级、是否接管已有文章 | 同上：`categoryMap`、`source.tier`、`takeoverExisting` |
| 同步频率 | `modules/aihot-bridge/server.ts` 的 4 条 `cron` |
| 请求间隔（对方限流） | `config.ts` 的 `minIntervalMs`（默认 1200ms） |

### C. 换/加一个模型榜数据源

1. 打开 `modules/leaderboard/config.ts`：
   - 换行业：关掉 `livebench`/`openrouter`，把 `json` 指向你的数据文件（Schema 见模块 README）；
   - 加一个新基准：在 `backend/sources.ts` 里照着 `livebenchSource` 写一个适配器（返回 `{models, scores}`），再在 `configuredSources()` 里加进去。
2. 跑 `node --env-file-if-exists=.env modules/leaderboard/scripts/sync.ts` 验证。
3. 数据源要记住三件事：**只用公开接口/公开数据集**、**不抓被保护的页面**、**页面注明来源**。

### D. 模型价格或日期挂错了行

`modules/leaderboard/config.ts` 的 `modelAliases` 里写一条例外：

```ts
modelAliases: { "smaug-flash": "某厂商/smaug-2-flash" },
```

页面底部会显示"本次匹配上 N/M 行"，用它核对有没有新的错配。

### E. 再新增一个模块

1. 目录 `modules/<名字>/`，放 `module.ts`（地址）、`server.ts`（后端）、`web.tsx`（网页插口）、`migrations/`、`tests/`、`package.json`（名字 `@aihot/<名字>`）。
2. `site/modules/` 的三份清单里各加一行（没有的那种插口就不用加）。
3. `site/package.json` 的 `dependencies` 加 `"@aihot/<名字>": "*"`；`Dockerfile` 加 `COPY modules/<名字>/package.json modules/<名字>/`。
4. 跑 `npm install` 让 workspace 链接与锁文件更新，然后 `npm run db:migrate`。
5. 迁移规矩（框架会检查）：文件名 `NNNN_小写名.sql`、编号 ≥ 0055、**每个文件只放一条在线安全语句**（建表可以，索引必须 `CREATE INDEX CONCURRENTLY IF NOT EXISTS`）。

### F. 改完必须跑的检查

```bash
npm run typecheck
DATABASE_URL=postgres://postgres@127.0.0.1:5433/aihot_test npm test     # 含架构检查（表归属、列是否都被用到、环境变量、模块隔离）
npm run test:standalone
node scripts/check-migrations.ts --base main                            # 迁移安全（CI 会跑）
npm run build -w @aihot/web && node --test apps/web/tests/*.test.ts     # 改了网页
```

---

## 6. 与上游同步时的注意事项

我们的改动分布在两类文件里：

**新增文件（不会冲突）**：`modules/aihot-bridge/`、`modules/leaderboard/`、`packages/backend/src/events/import.ts`、两个模块的 README。

**改过上游文件（含 `AGENTS.md` 里加的一段指针；可能冲突，合并时两边都要留）**：

| 文件 | 合并要点 |
|---|---|
| `site/modules/index.ts`、`server.ts`、`web.ts` | 保留上游的新行 **+** 我们的 `aihotBridge` / `leaderboard` |
| `site/package.json` | 上游的 dependencies **+** `@aihot/aihot-bridge`、`@aihot/leaderboard` |
| `Dockerfile` | 上游新增的 `COPY` **+** 我们两行 `COPY modules/*/package.json` |
| `.env.example` | 上游新增的变量 **+** `AIHOT_BRIDGE_*` |
| `AGENTS.md` | 我们加了一段指向本文档的说明；上游改这一段的概率低，冲突时两边都留 |
| `package-lock.json` | 别手改：合并后重跑 `npm install` 让它自己生成 |

`packages/backend/src/events/import.ts` 是新文件，但如果上游之后自己加了同名文件，按"同一个插口用上游的命名/位置"处理，把模块那边的 import 路径改过去。

---

## 7. 已验证的内容（这次做过的检查与结果）

| 检查 | 结果 |
|---|---|
| `npm run typecheck`（含网页类型） | ✅ 通过 |
| 后端测试 | ✅ 676 个全过 |
| 独立测试（不需要数据库） | ✅ 172 个全过 |
| 架构检查（8 条：表归属、列是否都被用到、环境变量、模块不互引、web 只走 HTTP 等） | ✅ 8/8 |
| 迁移安全检查 | ✅ 通过 |
| 真实数据：镜像 | 4400+ 条精选、13 个事件、47 期报告入库，页面/接口/RSS 都能读到 |
| 真实数据：模型榜 | 主榜 30 行 ×（综合 + 7 个能力列），26 行带上线日期与价格 |
| 页面 | `/` `/hot` `/daily` `/leaderboard` 全部 200 |

---

## 8. 还没做、已知边界（下次可以接着做）

**模型榜**
- 视觉还没对齐 AIHOT 的榜单页（我打不开那个页面：它对非浏览器 UA 返回 403，规则也禁止伪造 UA 绕过）。**拿一张截图就能照着调**。
- 没有历史快照，所以没有排名涨跌箭头（现在每次同步覆盖）。
- 手机端底部导航里还没有模型榜（只在桌面侧栏）。
- 跟别的榜单一样，只读第一方公开数据；不做跨基准的分数换算。

**AIHOT 镜像**
- 合规前置：**对外公开需要 AIHOT 的书面授权**（`modules/aihot-bridge/README.md` 开头有说明）。现在只在你自己机器上跑，属于内部使用。
- 热度的"参与来源数"比 AIHOT 页面上的小，因为只统计本站真正拿到的报道（这是有意的口径）。
- 事件之间没有关联（`story_links` 留给框架自己算）；镜像内容不进主题页（条目接口不给标签）。
- 首次会把 AIHOT 的精选快照走完：每 10 分钟最多 300 条，全量约需数小时（已走过一次）。
- 正文一律不镜像（只给摘要 + 原文链接），`site_fulltext` 保持关闭。

**运维**
- 数据库与 Node 都在 `/tmp`（见第 4 节）。
- 后台还没有镜像/榜单的专属页面（只有告警与命令行）。
