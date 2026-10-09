# 本站改动记录与操作手册

> 这份文档记录的是**这个仓库自己的改动**（不是框架上游的文档）。上游的框架文档在 `docs/` 的其他文件里。
> 对应的提交：`dev` 分支的 `406f2c8`「优化」（48 个文件，+4028 行）。`main` 保持上游原样，方便随时对比与合并。
>
> **2026-10-09 又做了一次改造：站点改成 AI FOMO**（品牌 + 焦虑指数模块 + AI 服务页）。详见第 9 节；
> 那一节是这次改动唯一需要读的地方，前面 0–8 节说的是此前那次（内容镜像与模型榜），两者互不影响。

---

## 0. 一页速查

### 现在多了什么

| 功能 | 位置 | 状态 |
|---|---|---|
| **AIHOT 内容镜像**（精选条目 + 正文 + 撤选 + 热点事件 + 日报周报月报） | `modules/aihot-bridge/`（23 个文件） | 已开（`AIHOT_BRIDGE_ENABLED=true`） |
| **自建模型榜**（评测名次 + 领域分数 + 上线日期 + 价格） | `modules/leaderboard/`（21 个文件） | 已开（每天 06:10 刷新） |
| **焦虑指数**（当天内容强度 + 读者投票） | `modules/fomo/`（见第 9 节） | 已开（无排程：读取时现算） |
| **AI 服务页**（介绍 + 跳转外链） | `modules/services/`（见第 9 节） | 已开，`entries` 还是空的 |
| **引擎插口：导入外部已定事件** | `packages/backend/src/events/import.ts`（143 行） | 被上面第一个模块调用 |
| **读层：每天发生了什么** | `packages/backend/src/publication/activity.ts` | 被焦虑指数模块调用 |
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
node --env-file-if-exists=.env modules/aihot-bridge/scripts/sync.ts all      # items|changes|events|reports|detail
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
| `server.ts` | 5 条排程 + 告警 |
| `backend/client.ts` | 对 AIHOT 公开 API 的 HTTP 客户端：单请求串行、1.2 秒间隔、ETag、429 按 `Retry-After` 等；`text()` 抓条目页 HTML，同一套节奏 |
| `backend/types.ts` | AIHOT 接口的响应类型（items / snapshot / changes / stories / dailies…） |
| `backend/mapping.ts` | 纯映射：条目 → 框架的分析字段；日报周报月报 → 框架的报告结构 |
| `backend/import.ts` | 落库：`upsertMaterial` 落料 → 写 `analyses` → 调公开层 `publishArticle` |
| `backend/events.ts` | 热点榜与事件：拉 hot-topics + 事件详情，交给引擎插口 |
| `backend/sync.ts` | 各路同步的编排（条目 / 撤选台账 / 报告 / 正文） |
| `backend/detail.ts` | **正文那一路上落库**：抓条目页 → 写 `articles` 正文 → 写中文 `translations` → 把随条目来的判断搬到新 revision |
| `backend/detail-page.ts` | 正文区块的纯解析：`div.prose`，按标签栈找它自己的闭合标签 |
| `backend/state.ts` | 自己两张表的读写 |
| `backend/summary.ts` | 每路同步的统计结构 |
| `backend/status.ts` | 给后台与告警看的状态 |
| `migrations/0100_aihot_bridge_items.sql` | 导入映射表（AIHOT 条目 id ↔ 本站文章 id、payload 哈希、是否本模块所有） |
| `migrations/0101_aihot_bridge_sync.sql` | 每路同步的游标/ETag/上次结果 |
| `scripts/sync.ts` | 手动同步 CLI（`items/changes/events/reports/detail/all`）。退出前先 `stopBoss()`：**发布正文会惰性启动 pg-boss**，只 `closeDb()` 的话脚本会一直挂着不退（已修） |
| `tests/` | 5 个测试文件（映射/正文解析纯函数 + 导入 + 事件 + 正文） |
| `README.md` | 模块说明（含合规前置条件） |

**它写入的框架表**：`articles`（含正文）、`analyses`（`origin='replay'`）、`translations`（`origin='replay'`）、`sources`、`reports`（`origin='imported'`），以及通过插口写 `stories`/`facts`/`fact_articles`/`story_signals`/`story_digests`。
**它绝不调用模型**：判断是随条目拿到的，条目进来时 `processing_state` 直接是 `analyzed`；正文那一路上是一个新 revision，模块在同一次事务里把判断搬到新 revision 并重新标成 `analyzed`，所以也不会触发付费分析。

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
条目页 /items/<id>/original ──原文──▶ articles.body_text/body_html + 新 revision ──▶ （只在库里/后台）
条目页 /items/<id> ──中文「正文 · AI 翻译」──▶ translations(origin=replay) ──▶ （只在库里）
      ⚠️ 这两份都不对外：镜像来源 site_fulltext=false → 公开读取层一律 body_mode='summary'
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

### A2. 本机抓信源报「Blocked private address」

**现象**：`scripts/collect.ts` 报 `Blocked private address for <域名>`，一条都抓不到。

**原因**：这台机器的 DNS 走了 fake-IP 代理（域名解析成 `198.18.x.x`），而引擎有 SSRF 保护，把这种地址当内网拦下。

**本机调试的解法**：`.env` 里开 `ALLOW_PRIVATE_NETWORK_FETCH=true`（框架文档里的本机调试开关）。

> ⚠️ **生产环境不要开**：它会关掉 SSRF 保护，而且 `NODE_ENV=production` 时框架**直接拒绝启动**。
> 正常服务器上 DNS 解析到公网地址，不需要这个开关。

镜像模块不受影响：它用的是自己的 HTTP 客户端，不走这层保护。

### A3. 第一次真跑一轮学到的（正文、成本、休眠）

**1. `COLLECT_ENABLED=false` 会把"取正文"一起关掉。**
取正文的队列注册在 `registerSourceJobs` 里（`jobs/sources.ts` 调用 `registerExtractionJobs`），而它只在
`COLLECT_ENABLED=true` 时注册。所以"先只开模型、不开采集"会让手动采集来的文章卡在待抽取。
→ 要让文章被完整分析，`COLLECT_ENABLED` 和 `MODEL_CALLS_ENABLED` **要一起开**。

**2. 正文抓不到时，模型只能看摘要，分数会明显偏低。**
抽取的顺序是：先直接抓页面 + Readability，失败才回退 **Jina Reader**（付费，需要 `JINA_API_KEY`）。
没有 Jina key 时，抓满 3 次（每次间隔 10 分钟）后文章降级为 `body_status='unconfirmed'`，按 RSS 摘要判断。

同一天同一批文章实测（T2 门槛 76）：

| 正文 | 评分 | 例子 |
|---|---|---|
| 有全文（`ok`） | **60 / 58** | OpenAI 将在欧盟默认给 ChatGPT 输出加水印 |
| 只有摘要（`unconfirmed`） | **40 / 23 / 20** | Nvidia 押注物理 AI / Radisson 接入 ChatGPT |

→ **要"选得准"，正文这一环不能省**：要么配 Jina（有免费额度），要么只用 feed 里自带全文的信源。

**3. 成本量级**（DeepSeek，6 篇文章 + 事件综述）：**34 次调用、6.8 万输入 token、2500 输出 token ≈ 7 分钱**，
摊到每篇约 **1 分多**。按这个量级，每天 100 篇大约 1–2 元。（精确金额要在后台「模型与价格」填单价，
`service_prices` 为空时后台不显示金额，只记 token 与耗时。）

**4. 吞吐被"每分钟预算 × 每 5 分钟 sweep"夹住。**
实测：每分钟调用数呈「20、1、20、1…」——一轮 sweep 放进来一批，几十秒内撞上 `per_minute` 上限，
被撞到的文章按 `BudgetExceededError` 推迟（`processing_retry_at`），只能等下**一轮 sweep（5 分钟）**再捡。
所以有效吞吐 ≈ `per_minute × 60 ÷ 6`（每篇约 6 次调用），而**不是** `per_minute × 60`。
放量时把 `per_minute` 调到几十以上（后台「设置 → 付费请求上限」，或直接改 `budgets` 表），否则会看起来"很慢"。

**5. 笔记本休眠 = 流水线停摆。** 实测 22:50→23:08 断了 18 分钟，因为整机睡了（排程、worker 一起停）。
正式部署要放在不睡的机器上；本机试跑时别合盖。

### B. 调镜像的行为

| 想改什么 | 改哪里 |
|---|---|
| 拉多少、窗口多大 | `modules/aihot-bridge/config.ts`：`itemsWindow`、`maxItemsPerRun`、`pageLimit` |
| 事件与热点 | 同上：`hotTopics.{top,maxReportsPerEvent,importMissingReports}` |
| 报告保留几期 | 同上：`reportHistory` |
| 每轮取多少条正文 | 同上：`detail.maxPerRun`（默认 60，每个条目最多两次请求） |
| 分类映射、来源分级、是否接管已有文章 | 同上：`categoryMap`、`source.tier`、`takeoverExisting` |
| 同步频率 | `modules/aihot-bridge/server.ts` 的 5 条 `cron` |
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
| `site/modules/index.ts`、`server.ts`、`web.ts` | 保留上游的新行 **+** 我们的 `aihotBridge` / `fomo` / `leaderboard` / `services`（后两个模块只有网页那一份清单） |
| `site/package.json` | 上游的 dependencies **+** `@aihot/aihot-bridge`、`@aihot/fomo`、`@aihot/leaderboard`、`@aihot/services` |
| `Dockerfile` | 上游新增的 `COPY` **+** 我们四行 `COPY modules/*/package.json` |
| `.env.example` | 上游新增的变量 **+** `AIHOT_BRIDGE_*` |
| `AGENTS.md` | 我们加了一段指向本文档的说明；上游改这一段的概率低，冲突时两边都留 |
| `package-lock.json` | 别手改：合并后重跑 `npm install` 让它自己生成 |
| `site/site.ts`、`site/pages/`、`site/brand/`、`site/changelog.json` | 我们按 AI FOMO 改过（第 9 节）；上游也动这几个文件时，**以第 9 节为准**，把上游新增的字段补进来 |

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

## 7.5 真实链路验证记录（2026-10-08，DeepSeek）

第一次用真实信源 + 真实模型跑通了整条链路，结论：**链路没有问题**。

| 项 | 数字 |
|---|---|
| 信源 | 18 个示范 RSS，一次抓完，0 失败（首次导入上限各 8 条） |
| 入库文章 | 100 篇（其中 89 篇 RSS 自带全文，无需 Jina） |
| 完整走完链路 | 23 篇：预筛 → 两次评分 → 结构化 → 中文标题摘要 → 归组 → 事件综述 |
| 进入精选 | **3 篇**（88 分 T2 / 80 分 T2 / 66 分 T1）；其余进「全部动态」 |
| 模型调用 | 161 次，输入 65.7 万 token，输出 1.19 万 token，平均延迟 965ms |
| 花费 | 按 DeepSeek 输入 ¥1/百万、输出 ¥2/百万估 **≈ ¥0.7**（约 **3 分/篇**） |
| 剩余 | 77 篇排队未分析（停阀门后不再消耗，随时可以继续） |

跑完这一轮顺手完善了 A3 节的三条经验：`COLLECT_ENABLED` 会连"取正文"一起关、
正文有无直接决定分数（60 vs 40）、吞吐被"每分钟预算 × 每 5 分钟 sweep"夹住。

**想继续跑**：`.env` 里把 `COLLECT_ENABLED=true`、`MODEL_CALLS_ENABLED=true`，再启动 worker；
77 篇会在下一轮 sweep 被自动捡起，不用手工干预。
**想停止花钱**：两个阀门设回 `false` 并停 worker（本次就是这么收的）；已加工的内容继续在站上服务。

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
- **正文已经镜像进库，但没有对外**：条目页上的「原文」进 `articles.body_text`，它的中文「正文 · AI 翻译」进 `translations`（都只在库里/后台）。镜像来源 `site_fulltext`、`syndicate_fulltext` 都是 `false`，公开读取层因此一律算作 `body_mode='summary'`，读者看到的仍然是摘要 + 原文链接。
- 正文只有页面上有，接口不给，所以这一路取的是 HTML：对方的路径或 `div.prose` 形状一变就取不到，会把条目记成 `unconfirmed`（"没有正文"）而不是写坏数据；改形状要动 `backend/detail-page.ts`。
- 正文回填是分批的：每 30 分钟 `detail.maxPerRun`（默认 60）条，4457 条约 19 小时走完；再加上下面的反爬墙，同一批要多跑几轮才齐。
- **对方有反爬墙（EdgeOne bot 管理）**：页面有时回 `403`，有时回一个 **1 KB 的 JS 挑战页（状态码还是 200）**，真实页面 40 KB。这一路**不解决挑战**（规则禁止绕过安全措施，模块里也没有浏览器内核），只把它认出来当作"这一轮没读到"，条目留到下一轮。**第一版就栽在这里**：把挑战页当成了"AIHOT 没有正文"，一次跑出 45 条假的 `unconfirmed`（已改回并修掉了判定条件）。
- 一轮一个页面都没读到（墙或形状变了）时，这一路把这一轮记成失败并报出来，不假装成功；连读 5 条都读不到就提前收手，不硬撞墙。本机实测：我这台机器的 IP 一旦被标记，静默 45 秒后每 3.5 秒一个请求仍然全是挑战页——这是对方的节奏，不是代码能绕的。
- 正文的**授权**比摘要严一层：「原文」的版权在原始站点手里，「中文正文」是 AIHOT 的 AI 翻译；要对外展示先取书面授权，只要原文的话建议直接抓原站。

**运维**
- 数据库与 Node 都在 `/tmp`（见第 4 节）。
- 后台还没有镜像/榜单的专属页面（只有告警与命令行）。

---

## 9. AI FOMO 改造（2026-10-09）

把之前那个独立的 ai-fomo 原型（Next.js 展示项目，数据存在内存里，重启即丢）里的**产品想法**搬进这个站：
站改成 AI FOMO，加一个「焦虑指数」模块和一个「AI 服务」介绍页。**没有搬原型的代码**，一共 0 行。

前提：内容来源沿用 AIHOT 镜像（使用者本人已取得授权）；**不做会员、不做支付**，所有人可用。

### 9.1 品牌改造（改的是已有文件）

| 文件 | 改了什么 |
|---|---|
| `site/site.ts` | 站名 `MyHOT` → `AI FOMO`；首页标题、`description`、`tagline`、`keywords`、`llmsIntro`；`mcpPrefix` → `aifomo`；`crawlerName` → `AIFOMOBot/1.0`；结构化数据的运营者名；关于页大标题与导语 |
| `site/brand/logo.svg`、`icon.png`、`icon-192.png`、`apple-icon.png`、`favicon.ico` | 换成本站自己的标记：深底圆角方块 + 一条信号脉冲线（原有那套是框架自带的中性星形） |
| `site/pages/terms.md` | 从框架模板改写成 AI FOMO 的使用规则；新增「焦虑指数与热词」「站外服务」两节 |
| `site/pages/privacy.md` | 新增第 3 节：投票与热词只存不可还原的散列标识，**不存原始 IP** |
| `site/changelog.json` | 换成 AI FOMO 上线记录（`date` 用的是改造当天，你自己改上线时间） |
| `.env.example` | 顶部注释里的站名 |

**上线前必须你自己填**：`site/pages/terms.md` 与 `site/pages/privacy.md` 顶部表格里的
**生效日期、运营主体、联系方式**（现在写的是「待填写」）。法律文本我不替你决定。

`site/brand/nameplates/`（日报/周报/月报的报头字）**不用重做**：行业词还是「AI」，报头仍是「AI日报/周报/月报」。

### 9.2 新增模块 `modules/fomo/` —— 焦虑指数

页面 `/fomo`；公开接口 `GET /api/fomo/today`、`POST /api/fomo/vote`、`POST /api/fomo/hotword`、
`POST /api/fomo/signal`、`POST /api/fomo/agree`、`POST /api/fomo/report`；后台接口见 9.10。
算法、表、配置项写在模块自己的 `README.md`，这里只记这次的设计取舍：

- **指数 = 60% 内容强度 + 40% 读者情绪**，内容强度又由 精选条数 40% / 独立事件 25% / 一手来源占比 20% / 平均分 15% 合成。
  满分线取「固定下限」与「本站最近 30 天的 90 分位」里更高的那个，**窗口不含今天**（忙碌的一天不抬高自己的门槛）。
  当天没有投票时指数就是内容强度，而不是打折。
- **内容那一半没有表、没有排程**：读取时从引擎自己的表现算（见 9.4），worker 不跑也能看，
  不存在"快照与真实情况不一致"的问题。这个模块**不注册任何定时任务和告警**。
- **读者那一半四张表**：`fomo_votes`（主键 `(day, voter)`，一人一天一票，同一天再投是改票）、
  `fomo_hotwords`（主键 `(day, word, voter)`，读者补充的热词，一人一天 5 个）、
  `fomo_signals`（读者发的内容）、`fomo_signal_marks`（一个人对一个信号的 `agree` / `report`）。
- **匿名标识复用引擎已有的那套**：`operations/feedback.ts` 的 `feedbackSourceHash`（HMAC(地址+浏览器类别)），
  全站一个读者一个标识，没有新引入第二个密钥机制，也没读新的环境变量。
- 热词不是从正文里瞎猜：用当天精选条目**自己带的标签与分类**（走读层的 `dayTopics`）。
- 页面上还有**分享**（X / 邮件 / 复制指数 / 复制链接 / 保存分享图 / 系统分享）与**关注 X**；
  X 地址在 `modules/fomo/config.ts` 的 `share.xProfile`，`null` 时按钮不显示。

### 9.3 新增模块 `modules/services/` —— AI 服务页

页面 `/services`，无数据库、无接口、无排程，页面完全由 `modules/services/config.ts` 的 `entries` 数组生成。
**现在 `entries` 是空的**，页面显示一句「还没有配置」。要放中转站或别的服务时，按模块 README 里的形状加一条。
使用规则页第 6 节与隐私说明页已经写明「本站不是这些服务的提供方」。

### 9.4 引擎侧新增的文件：`packages/backend/src/publication/activity.ts`

按「所有公开出口都从 `publication/` 这一个读层读」的规矩，指数的内容那一半不能自己写 SQL 查 `publications`。
这个文件提供两个通用读取函数：`dailyActivity(since, until)`（每天选了多少条、几个事件、几个来源、一手占比、平均分）
与 `dayTopics(day)`（当天条目的标签与分类）。它按 `scope.ts` 的 `selectedCondition` 过滤，
所以**撤选和下架立刻生效**——和站上其他公开出口同一套可见性规则，有一条测试盯着这件事。

### 9.5 顺手避免的两处重复

- 北京日期一律用已有的 `@aihot/contracts/time`（`beijingDate` / `beijingMidnight` / `addDays`），
  没有新增第二个日期实现。**注意** `notify/feishu.ts` 里那个同名的 `beijingDay()` 返回的是「9月29日」这种
  给人看的写法，**不是日期键**，别混用。
- 读者身份用反馈系统已有的散列，没有为投票再写一套。

### 9.6 怎么关掉这两样

| 想做什么 | 怎么做 | 留下的东西 |
|---|---|---|
| 从导航里拿掉焦虑指数 / AI 服务 | 删 `site/modules/web.ts` 里对应那一行 | 页面还在，只是没有入口 |
| 完全不装焦虑指数 | 删 `site/modules/{index,server,web}.ts` 里的 `fomo` 行、`site/package.json` 与 `Dockerfile` 的对应行，再删 `modules/fomo/` | 库里四张 `fomo_*` 表与数据 |
| 只想去掉社区信号、留下投票与热词 | 删 `modules/fomo/module.ts` 的 `adminPages`、`server.ts` 里 `/api/fomo/{signal,agree,report}` 与三个 `/api/admin/fomo/*` 路由、页面里的 `Signals` 一块 | 两张 `fomo_signal*` 表与数据 |
| 完全不装 AI 服务页 | 删 `site/modules/{index,web}.ts` 里的 `services` 行、`site/package.json` 与 `Dockerfile` 的对应行，再删 `modules/services/` | 无（没有表） |
| 只调指数口味 | `modules/fomo/config.ts`：权重、满分线下限、回看天数、分档、热词上限与拒收词 | — |
| 只调社区信号的口径 | `modules/fomo/config.ts` 的 `signal`：长度、发言间隔、每天条数、举报下架阈值 | — |
| 只调服务页文案 | `modules/services/config.ts`：标题、说明、列表下面那句 note、entries | — |

### 9.7 分享图与手机端入口（同一批改动，后来补的）

模块页面默认只有标题和描述，**没有 og 标签、也没有 `handle`**——分享出去没有预览，手机上也点不到。
这次一并补齐了三处：

| 补了什么 | 怎么补的 |
|---|---|
| 三张页面的分享图 | `site/site.ts` 的 `CARDS` 加 `fomo` / `services` / `leaderboard` 三个 key；三个页面的 `meta()` 改用 `@aihot/web/lib/seo` 的 `pageMeta`，给 canonical、og:title、og:image 等一整套 |
| 手机底部标签栏 | `modules/fomo/web.tsx` 的 `tabs` 加一项（标签「指数」）。**标签栏只支持 4 或 5 列**（`components/shell/TabBar.tsx` 的 `COLUMNS`），所以只能加一个模块标签，给了指数 |
| 手机上的模型榜与 AI 服务 | 标签栏满了，改用「我的」页：两个模块的 `web.tsx` 各加一行 `tools`，页面自己用 `handle` 声明 `{ tab: "me", name: … }`，返回时标签和返回按钮的文案才对 |

模型榜那两处（og 与 `handle`）是顺手修的老问题，不是这次新加的功能；不想要就按第 6 节的方式把这三行删掉。

### 9.8 把原版剩下的主要功能补上（第三批）

第一版只迁了投票与热词，原版 ai-fomo 还有几块明显的东西没搬。这一批补齐：

| 原版有什么 | 这次怎么落地 |
|---|---|
| `FragmentComposer` + `FragmentFeed`（读者发一段话、别人认同） | `fomo_signals` + `fomo_signal_marks` 两张表；`POST /api/fomo/signal`、`/agree`、`/report`；页面上「大家在说什么」一块 |
| `ShareModal`（Slack / Email / X） | 「分享今天」一块：分享到 X（intent）、邮件分享（mailto）、复制指数、复制链接、保存分享图（`/og/pages/fomo.png`）、手机上的系统分享。Slack 那条原版只是假按钮（写死 `#ai-hype`），这里没做——要做得要你自己的 webhook 地址 |
| `XFooter` 的「Follow on X」 | `config.ts` 的 `share.xProfile` 填上就出现「关注 X」按钮（现在是 `null`，不显示） |
| `XFooter` 的「Export report」 | 用「保存分享图」+「复制指数」代替：分享图是 api 生成的 PNG，指数摘要进剪贴板 |
| `StatPill` 的三个数字 | 指数下面一排真实数字：今日投票 / 今日信号 / 今日热词 / 累计信号（原版那三个是写死的示例数，没有照搬） |
| `FeatureCard`、`Hero` 落地页 | **没有搬**：AIHOT 的首页本身就是落地页，再放一层宣传卡片是重复 |
| `seed/*.json`、`seed/signals.ts`、`/api/seed` | **没有搬**：演示数据与演示接口，线上不需要 |

**社区内容是全站唯一一块用户生成内容**，所以这次同时做了治理：

- 限制：2–200 字；一人 5 分钟一条、一天 5 条；署名选填（最长 24 字）。
- **举报到 2 个不同的人自动下架**（阈值在 `config.ts`），等站长处理。
- 站长在 **后台「社区信号」页**（`/admin/fomo-signals`）恢复或删除；导航角标数是"已下架等着看"的条数
  （`admin.counts`，和引擎其他角标一个意思）。
- 后台三个接口 `/api/admin/fomo/signals*` 走**引擎同一套会话与 CSRF 校验**：模块直接用
  `@aihot/backend/admin/auth` 的 `sessionPrincipal` 和会话里的 csrf 做守卫（引擎的 `adminHandler` 在 `apps/api`
  里，模块不能从那里引），没有会话 401、写操作缺 CSRF 403——有测试盯着这两件事。

`site/pages/privacy.md` 第 3 节与 `site/pages/terms.md` 第 5 节也跟着改了：读者发的内容是公开的，
怎么算、存什么、举报到下架都写清楚了。**改这类文本你自己再确认一遍。**

### 9.9 这次跑过的检查

| 检查 | 结果 |
|---|---|
| `npm run typecheck`（含网页类型） | ✅ 通过 |
| `npm test`（后端全量，含 fomo 的 5 + 8 个数据库测试） | ✅ **728 个全过**，0 失败 |
| `npm run test:standalone`（含 fomo 的 19 个纯函数测试） | ✅ 通过 |
| 架构检查 8 条（表归属、每列都被用到、公开出口只走读层、模块不互引、环境变量） | ✅ 8/8 |
| `npm run build -w @aihot/web` | ✅ 通过 |
| `node scripts/smoke.ts --base http://127.0.0.1:3000` | ✅ 全过 |
| 页面 | `/fomo` `/services` `/leaderboard` 200；三张分享图 200；`/admin/fomo-signals` 未登录 302 跳登录 |
| 品牌是否漏改 | ✅ `/llms.txt`、`/feed.xml`、`/manifest.webmanifest`、MCP 工具名（`aifomo_*`）全无旧站名 |
| 投票与热词实站验证 | ✅ 一人一天一票可改；第 6 个热词返回 429；库里只有散列标识，没有 IP |
| 社区信号实站验证 | ✅ 发出→上墙；三个不同来源（带 `X-Forwarded-For`）里两个人举报 → 自动下架、原因记为「读者举报」；后台列表/恢复/删除都通过；无会话 401、缺 CSRF 403 |

`node --test apps/web/tests/*.test.ts` 有 10 个失败，**全部来自 `navigation-performance.test.ts`，原因是这台机器没装 Playwright 的 Chromium**
（`npx playwright install chromium` 可解决）。该文件这次没动过，改动前也跑不了。

### 9.10 还没做

- **社区信号没有关键词过滤**，也不排队审核：先发后审 + 举报自动下架 + 人工恢复。
- **`/services` 的 `entries` 是空的**，等你给服务名和链接。
- **条款页的三项待你填**（生效日期、运营主体、联系方式）。
- 本机开发时所有请求都来自 127.0.0.1，所以**本机测试里所有人算同一个读者**（引擎的反馈限流也是这样）；
  线上经 Caddy/nginx 时 api 读 `X-Forwarded-For`，按真实访客区分。
- 页面数据没有 `clientLoader` 复用（每次客户端导航都会重新取一次接口）：量小，先用着。

### 9.11 首页入口与界面重做（2026-10-09，第四批）

使用者的反馈是两句话：**界面样子不对**（做成了一页平淡的列表）和**入口不够显眼**（首页看不见）。
这一批的取舍：整站保持引擎的浅色纸面风，指数是站里唯一的深色对象；入口做进首页第一屏。

| 改了什么 | 怎么改的 |
|---|---|
| **引擎加首页插口**（唯一动引擎的地方） | `apps/web/app/modules.ts` 的 `WebModule` 加 `home?: { card?: ComponentType }`；`apps/web/app/routes/home.tsx` 在筛选栏之下、热点话题之上渲染各模块的卡。照 `starredImports`/`termsLinks` 的既有模式 |
| **首页深色指数卡** | 新增 `modules/fomo/web/home-card.tsx`：当天的数字、分档、量尺与三档刻度，可以直接投票（与 `/fomo` 共用 localStorage 的已投状态），「完整指数 →」进 `/fomo`。浏览器端 fetch 相对的 `/api/fomo/today`（走站点自己的代理），加载中占位、api 不可用时说明而不消失 |
| **`/fomo` 页面重排** | 逻辑与接口一行没动，只换了皮：页头改成与首页同语言的深色 gauge 卡（大数字 + 分档 + 渐变量尺 + 投票），参与区块（热词、社区信号）前置到趋势与构成之前，统计数字改成药丸排，热词榜改成带 `#排名` 的榜。共享视觉抽到 `modules/fomo/web/card.tsx` |
| **侧栏提级** | `modules/fomo/web.tsx` 的 sidebar 从「内容」分区挪到自己的「指数」分区（模块分区渲染在引擎「内容」与「更多」之间，不用改引擎导航）。手机标签栏第五格不动 |

**量尺的绿→黄→红渐变是站点里唯一一处渐变**（引擎的组件审美是"无渐变"）：指数的三档（冷静/躁动/恐慌）
本身就是从好到坏，这个渐变是数据编码而不是装饰，用了引擎自己的 `ok / amber / hot` 三个 token。深色卡的
底色与文字是固定值，不跟随读者的深浅色主题，两种主题下都可读。

**顺手修了一个预存的 bug**：`web/fomo.tsx` 原来在模块顶层写 `process.env.API_BASE_URL`——浏览器里没有
`process`，整个路由模块在浏览器加载即抛错，**页面上所有按钮（投票、热词、信号、分享）实际都是死的**，
控制台一直有 `process is not defined`。现在 loader 在服务端用 `@aihot/web/lib/api.server` 的
`API_BASE_URL`（`.server` 文件不会进浏览器包），浏览器端一律走相对路径的 `/api/fomo/*` 代理——
这与它自己发 POST 的方式、与首页卡的方式一致。已实站复测：点「还好」→ 指数与票数即时更新，console 干净。

这一批跑过的检查：`npm run typecheck` ✅；`npm test` 728 全过 ✅；`npm run test:standalone` 196 全过 ✅；
`npm run build -w @aihot/web` ✅；`node --test apps/web/tests/*.test.ts` 32 过 / 10 失败（同第 9.9 节，
全部是预存的 Playwright 浏览器版本问题）✅；`scripts/smoke.ts` 全过 ✅；实站投票/首页卡交互复测通过 ✅。

---

## 10. eva-s-fomo-finder 功能迁入（2026-10-09，第四批之后）

### 10.1 先发生了一次彻底回滚，再从备份恢复

方向定下来是**把另一个项目（`../eva-s-fomo-finder`，Lovable 构建的 EVA 风原型）的功能迁进本站**，
风格保持引擎自己的。动手前按旧交接文档（工作区根的 `HANDOFF.md` 第 8 节）把工作区**全部回滚**过一次：

- 未提交的 25 个路径先整体备份到工作区根 `../aihot-backup-2026-10-09/`（另打成 `aihot-backup-2026-10-09.tar.gz`），
  然后回滚到 `aa51e10` 的干净状态，测试库里的 `fomo_*` 表也删了（架构检查盯着"有表没代码"）。
- 回滚之后，本批要的功能**从备份原样恢复**（属于"迁移的数据层与已验证代码"，不是重写）：
  `modules/{fomo,services}`、`publication/activity.ts`、引擎 home 插口两个文件、品牌与站点文件、
  模型榜的三处顺手修复、`docs/site-changes.md` 的第 9 节。

### 10.2 这一批新迁的功能（来源全部是 `../eva-s-fomo-finder`）

| eva 里的功能 | 迁成了什么 |
|---|---|
| `AITimeline` / Timeline 页（大事记） | **`/timeline`**（`modules/fomo/web/timeline.tsx`）：最近 14 天，每天一行——指数、选出条数/事件/来源、当天评分最高的报道（`GET /api/fomo/insights`；读层新增 `activity.ts` 的 `dayTopReports`） |
| `Trends` / `FOMOTrends` / `industry_indices` | **`/trends`**（`modules/fomo/web/trends.tsx`）：指数近 30 天走势 + 最近 7 天产出（同一 insights 接口）+ 主题热度 TOP 12（引擎 `/api/site/topics`） |
| `WhatIsFOMO` | `/fomo` 页下部静态说明区块「什么是 AI FOMO？」，文案原样保留 |
| `FOMOQuiz` + `fomo-quiz.ts` | **新模块 `modules/quiz`**：`/fomo-test`，10 题五维、100 分制、S–D 五档；浏览器本地算分，**不存任何数据** |
| `AnxietyTest` + `anxiety-quiz.ts` | `/anxiety-test`：5 题、50 分制、等级+建议+渐变量尺；与生存测试互相导流 |
| `AITools` / `HotToolsGrid` | `modules/services` 页面路径 **`/services` → `/tools`**（配置驱动介绍+外链，`entries` 仍为空） |
| `FomoFeed` / `Feed` / `Timeline`（信息流） | 不迁——引擎的内容流本身就是完整实现 |
| `CyberNav` / `EVAOverlay` 等 EVA 皮肤 | **不迁**（使用者明确：不用 EVA 风，保持引擎风格） |
| `Login` / `CreatorProfileEditor` / Supabase | **不迁**（本站公开内容匿名原则；数据走引擎自己的 Postgres） |
| `mock-leaderboard`（演示排行） | **不迁**（假数据）；原测验页的昵称/行业登记也一并省去 |

导航现状：桌面侧栏「指数」分区 = 焦虑指数 / 大事记 / 趋势 / FOMO 测试 / 焦虑测试（前三个在
`modules/fomo/web.tsx`，后两个在 `modules/quiz/web.tsx`）；`site/modules/{index,web}.ts` 加了 `quiz` 行，
`site/package.json`、`Dockerfile` 各加一行；分享图 `CARDS` 加了 `timeline`、`trends`，`services` key 改名 `tools`。

### 10.3 本批的运维教训（下次别踩）

- **api 是裸 `node` 启动的，没有 watch**：改了后端（模块、路由、读层）必须重启 api 进程，否则新路由 404、
  旧代码继续跑。本批 `/api/fomo/insights` 404 就是这么来的。
- **web 的 vite dev 对模块文件增删不敏感**：新增模块页面后即使重启，也可能因为
  `apps/web/node_modules/.vite` 预打包缓存继续用旧模块图（表现为 typegen 有路由、页面却 404）。
  重启前删掉 `apps/web/node_modules/.vite`。
- 两台服务本批由 Agent 重启过：api `node --env-file-if-exists=.env apps/api/src/main.ts`（:3001）、
  web `npm run dev -w @aihot/web`（:3000），都是后台进程。

### 10.4 本批跑过的检查

| 检查 | 结果 |
|---|---|
| 回滚后基线 | `npm test` 696 全过（架构检查报过一次"表没代码"，是测试库残留，清掉即绿） |
| 恢复 + 新增后 | typecheck ✅；`npm test` **732 全过**（+4 个 quiz 题库测试）✅；`test:standalone` 200 全过 ✅；`build -w @aihot/web` ✅ |
| web 测试 | 32 过 / 10 失败——仍是第 9.9 节那个 Playwright 浏览器版本问题，与本批无关 |
| smoke | ✅ 全过（web 500 的中间态是 dev server 没跟上文件增删，重启 + 清 `.vite` 后恢复） |
| 实站 | `/` `/fomo` `/timeline` `/trends` `/fomo-test` `/anxiety-test` `/tools` 全 200；侧栏「指数」分区五项齐全；生存测试全流程点完（10 题 → 100 分 S 级 + 五维条形）；`/fomo` 底部出现「什么是 AI FOMO？」；`/api/fomo/insights` 200 |
| 数据 | 测验不上传任何数据；`fomo_*` 四张表为空（0/0/0/0） |

### 10.5 还没做（下一步开发可以接着做）

- `/tools` 的 `entries` 仍是空的，等使用者给服务清单。
- `share.xProfile` 仍是 `null`（「关注 X」按钮不显示）；条款页三项（生效日期/主体/联系方式）仍待填。
- eva 项目里**没有迁**的：登录/创作者资料（已定不迁）、html2canvas 客户端分享图（引擎 OG 图已够用，想要再迁）、
  mock 排行榜（假数据）。EVA 皮肤按使用者要求不迁，**别再提**。
- worker 仍没跑：今天没有新内容时 `/timeline`、指数都是 0——要见真数据开 `COLLECT_ENABLED`/`MODEL_CALLS_ENABLED` 跑 worker（会花模型的钱）。
- 工作区（dev 分支）依旧一个 commit 都没提交，全部未提交改动 + 本批的都在。
