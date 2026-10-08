# AIHOT 镜像模块

把 AIHOT（[aihot.news](https://aihot.news)）已经做好的成品搬进这个站：它写的中文标题、摘要、
推荐理由、评分、分类，以及它的日报、周报、月报。**全程不调用任何模型**——判断是随条目一起拿到的，
这个模块只负责落库和交给公开读取层。

> **先读这一段：对外公开使用需要 AIHOT 的书面授权。**
> AIHOT 的[公开使用规则](https://aihot.news/terms)允许个人非商业、公益非商业和组织**内部**使用免费；
> 但"公开镜像、换皮站、白标产品、批量公开再分发"和"以 AIHOT 的持续数据供给替代本站的公开服务"
> 属于**必须提前取得书面授权**的情形（联系邮箱见该页）。规则同时要求：保留来源与原文链接、
> 不要暗示官方背书、遵守限流与缓存约定、对方撤回时尽快同步。
> 这个模块按这些要求实现（来源名原样保留、原文链接即文章地址、撤回会同步、限流与 ETag 按约定），
> 但**是否上线、是否对外，是站点运营者自己的决定**，本模块不代为判断。

## 它做什么

| AIHOT | 落到这里 | 读者看到 |
|---|---|---|
| 精选条目的中文标题 / 摘要 / 推荐理由 / 评分 / 分类 | `analyses`（`origin = 'replay'`） | 首页精选、条目页、分类页 |
| 条目对应的原文 | `articles`（身份就是原文网址） | 每条都链回原文 |
| 来源名 | 每个来源一个 `sources` 行（`kind = 'external'`） | 条目上的来源署名 |
| 精选集合的增删 | `publications.selected` | 进/出精选，全部动态里仍然在 |
| 热点榜（Top 10）与事件：报道时间线、AI 综述 | `stories` / `facts` / `fact_articles` / `story_signals` / `story_digests`（`origin = 'replay'`） | `/hot` 热点榜、`/story/<id>` 事件页、热度走势 |
| 日报 / 周报 / 月报 | `reports`（`origin = 'imported'`） | `/daily`、`/weekly`、`/monthly` 与对应 RSS/API |

不搬的部分：正文（一律只给摘要 + 原文链接，`site_fulltext` 保持关闭）、标签与主题归属
（AIHOT 的条目接口不给标签，所以这些条目不进主题页）、**热度本身**。

热度不是搬来的，是按这个站自己的规则重算的（48 小时窗口、每个独立来源只算一次、24 小时半衰期）。
所以榜单上每个事件的"参与来源数"是**这个站真正拿到的那几篇**，会比 AIHOT 页面上的数字小——
那正是这个站自己的口径。事件的分组（哪几篇报道是一件事）来自 AIHOT；这件事归谁排前面，由这里决定。

## 打开它

1. `site/modules/server.ts` 里已经列了这一行（不想要就删掉）：

   ```ts
   import aihotBridge from "@aihot/aihot-bridge/server";
   export const SERVER_MODULES: readonly ServerModule[] = [aihotBridge];
   ```

2. `site/package.json` 的 `dependencies` 里写 `"@aihot/aihot-bridge": "*"`，Dockerfile 里已有
   `COPY modules/aihot-bridge/package.json modules/aihot-bridge/`。
3. `.env` 里打开开关，然后重启 worker（排程在 worker 启动时读取开关）：

   ```bash
   AIHOT_BRIDGE_ENABLED=true
   # AIHOT_BRIDGE_BASE_URL=https://aihot.news   # 只在指向一份 API 副本时改
   ```

4. 想马上看效果，不用等排程，手动跑一次（首次会拉 7 天内的精选）：

   ```bash
   node --env-file=.env modules/aihot-bridge/scripts/sync.ts all
   ```

   脚本**尊重开关**：`AIHOT_BRIDGE_ENABLED` 不是 `true` 就拒绝出网，加 `--force` 才强行跑。
   也可以只跑一路：`items`、`changes`、`reports`。

## 排程与告警

| 排程 | 频率 | 做什么 |
|---|---|---|
| `aihot-bridge.items` | 每 30 分钟 | 拉最新精选，翻到"已经有的那条"就停 |
| `aihot-bridge.changes` | 每 10 分钟 | 走他们的精选增量台账，**撤选会同步撤回**（文章留在站上，只是离开精选） |
| `aihot-bridge.hot` | 每 30 分钟（第 7、37 分） | 同步热点榜 Top 10 的事件：报道时间线、AI 综述、成员报道 |
| `aihot-bridge.reports` | 每天 9/10/11 点 | 同步最近 30 期日报、12 期周报、12 期月报（只在对方那期变了才改） |

开关关掉时，这三条排程在 worker 启动时会被移除（框架的 `when` 插口）。同步连续失败或超过 12 小时
没有成功过，会走站点已有的告警（后台 + 飞书内部群）。

## 它怎么对待这个站自己的内容

- **不会抢**：如果同一条新闻你自己的信源已经采到了，这个模块只记一条"我见过"，
  不写分析、不发布，交给你自己的编辑流程和模型。想让镜像覆盖它，把 `config.ts` 的
  `takeoverExisting` 改成 `true`（默认 `false`）。
- **判重就是原文网址**：用的是框架自己的 `upsertMaterial`，所以同一条新闻来自谁都是同一篇文章。
- **不占"今天"**：抓到时已经发布超过 48 小时的条目按框架规则归档，不进"今天"也不推送。
- **不用你的模型额度**：这条链路上没有任何模型调用（`lib/` 里的分析、写作、归组都不会被触发，
  条目进来时 `processing_state` 直接是 `analyzed`）。

## 设置（`config.ts`）

| 字段 | 默认 | 说明 |
|---|---|---|
| `itemsWindow` | `7d` | 拉取窗口，AIHOT 的 items 接口只支持 `24h` / `7d` |
| `maxItemsPerRun` | 300 | 单次运行的上限，首次导入不会跑一整夜 |
| `reportHistory` | 30/12/12 | 各保留多少期 |
| `categoryMap` | `{}` | 你的行业分类和 AI 分类不同的时候，把 AIHOT 的分类映到你的 key |
| `hotTopics.top` | 10 | 镜像热点榜的前几件事件 |
| `hotTopics.maxReportsPerEvent` | 20 | 一件事件最多挂多少篇报道 |
| `hotTopics.importMissingReports` | `true` | 事件里这个站还没有的报道，作为普通池内条目补进来（**永远不进精选**），这样时间线才是完整的 |
| `source.tier` | `T2` | 镜像来源在热度与代表报道里的分级 |
| `takeoverExisting` | `false` | 见上 |
| `minIntervalMs` | 1200 | 请求间隔，AIHOT 要求约每分钟不超过 60 次 |

## 接口约定（照 AIHOT 的要求写死在代码里）

- 一次只发一个请求，间隔不低于 `minIntervalMs`；`429` 按 `Retry-After` 等待，不并发重试。
- 带条件请求（ETag / `If-None-Match`），增量走他们的 `cursor`，翻页碰到已有的就停。
- 保留 `attribution`：来源名原样存进 `sources.name`，原文链接就是文章地址。
- 撤选走 `op: remove`：由 `publications.selected` 表达，不删文章、不改历史。

## 它接到了框架的哪个插口

事件那几张表（`stories`、`facts`、`fact_articles`、`story_signals`、`story_digests`）按架构约定
只有 `events/` 能写（`tests/architecture.test.ts`），所以框架里加了一个通用插口
[`packages/backend/src/events/import.ts`](../../packages/backend/src/events/import.ts)：
"导入一件别处已经定好的事件"。它不认识 AIHOT，任何镜像、迁移或内部工具都能用；它只写
`origin = 'replay'` 的事件，**这个站自己归的事件（`origin = 'model'`）和编辑改过的（`'manual'`）
一概不碰**。综述按读取层的证据指纹写入，所以它只在背后那几篇报道仍然公开时才显示。

## 已知边界

- AIHOT 只有"最近 7 天"的条目接口和一份精选快照；更早的历史要翻完快照（模块会跨多次运行接着翻，
  状态在 `aihot_bridge_sync.detail.snapshotPage`）。
- 热度走势图需要可比的历史（这个站自己的信源时钟），刚接上的站会显示"暂不比较"，跑几天自然就有。
- 条目接口不给标签，所以镜像内容不出现在主题页里。
- 事件之间没有关联：`story_links`（相关事件）留给框架自己的规则算。
- 健康状态下它的 `/api/v1/items` 与本模块的分页是一致的；对方改了返回结构时，同步会失败并在告警里说。
