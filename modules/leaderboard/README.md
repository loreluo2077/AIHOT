# 模型榜模块

一个**自建**的模型榜：只读第一方公开数据，页面注明每个数字的来源与版本。它不搬运别家的榜单成品，
也不替谁跑评测。

- 页面：`/leaderboard`（桌面侧栏「内容」里的一项；手机上在「我的」页里）

## 页面长什么样

**一张主榜**，一行一个模型：

| 名次 | 模型 | 综合 | Reasoning / Coding / Agentic Coding / Mathematics / Data Analysis / Language / IF | 上线 | 价格/百万 |
|---|---|---|---|---|---|

- 「综合」是基准**自己发布**的综合分；各能力列是该类别下各任务的平均分，按模型在该列里的最高分画一条底纹，方便扫。
- 表头上方是排序切换：按综合，或按任一能力列排。
- **上线日期和价格来自另一个来源**（模型目录），按模型名匹配到同一行；页面底部会写明这次匹配上多少行，未匹配的显示「—」并标「目录未收录」。
- 下面是可折叠的「模型目录」（最新 60 个），以及每个数据源的版本与许可。
- 接口：`/api/leaderboard`（公开只读，`cache-control: max-age=300`）
- 数据：三个适配器，见下；每天 06:10 自动刷新一次

## 数据源

| 来源 | 读什么 | 授权与礼貌 |
|---|---|---|
| **LiveBench** | 该基准**自己仓库里**发布的最新一张成绩表（CSV）：每个模型、每项任务、每项分数 | 表格由 LiveBench 公开；站点 `robots.txt` 全放行；仓库里注明来源 |
| **OpenRouter** | 它的**文档化公开接口** `/api/v1/models`：465 个模型的上下文长度、每百万 token 价格、发布时间、模态 | 公开接口、无需 key；价格以其页面为准 |
| **你自己的 JSON** | 任意本地文件或 https 地址（`config.ts` 的 `json`） | 由你决定，页面会显示你写的 `licence` |

**不会做的事**：抓页面、绕限流、伪造 User-Agent、把两家的分数混算成一个"综合分"。
LiveBench 的"综合"就是它自己表格里那一行；类别表是这个模块对该类别各任务取的算术平均，
并在页面上写明是"该类别各任务的平均"。

### 换成你行业的榜

`config.ts` 里把 `livebench` / `openrouter` 关掉，配上 `json`：

```ts
json: {
  key: "my-benchmark",
  label: "某某评测",
  url: "/srv/data/benchmark.json",     // 本地绝对路径，或 https 地址
  licence: "由某某评测机构公开，引用请注明",
}
```

JSON 的形状（`models` 与 `scores` 都可以只给一个）：

```json
{
  "models": [
    { "name": "某模型", "vendor": "某公司", "releasedAt": "2026-01-02",
      "contextLength": 128000, "priceIn": 1.5, "priceOut": 6, "modality": "text->text" }
  ],
  "scores": [
    { "model": "某模型", "metric": "综合", "metricGroup": "总体", "value": 88.5, "isOverall": true },
    { "model": "某模型", "metric": "事实性", "metricGroup": "能力", "value": 91 }
  ]
}
```

`modelKey` 不给就按名字生成（大小写、括号、连字符都会归一），所以 `scores` 里的 `model` 和 `models`
里的 `name` 用同一种写法就能对上。

## 打开它

1. 模块的 backend 已经列在 `site/modules/server.ts`，页面在 `site/modules/index.ts`，导航在
   `site/modules/web.ts`（不想要就删掉对应那一行；侧栏与「我的」页里的导航项在 `modules/leaderboard/web.tsx`）。
2. `site/package.json` 的 `dependencies` 里写 `"@aihot/leaderboard": "*"`；Dockerfile 里有对应的 `COPY`。
3. 迁移会跟着 `npm run db:migrate`（或 compose 的 setup）一起执行。
4. 想马上有数据，不用等排程：

   ```bash
   node --env-file=.env modules/leaderboard/scripts/sync.ts
   ```

## 排程与告警

| 排程 | 频率 | 做什么 |
|---|---|---|
| `leaderboard.sync` | 每天 06:10 | 读一遍所有已配置的来源 |

某个来源连续失败或 72 小时没有成功更新，会走站点已有的告警（后台 + 飞书内部群）。
读取失败**不会清空**已有数据：页面继续显示上一次成功的名次，只记下失败原因。

## 设置（`config.ts`）

| 字段 | 默认 | 说明 |
|---|---|---|
| `rowsPerMetric` | 30 | 主榜列前多少名 |
| `primarySource` | `null` | 哪个来源驱动主榜；`null` 表示取第一个发布了综合分的来源 |
| `modelAliases` | `{}` | 名称匹配规则的例外：`{ "smaug-flash": "某厂商/smaug-2-flash" }` |
| `domainOrder` | 见文件 | 能力列的顺序；没列到的类别排在后面按名称排 |
| `catalogueRows` | 60 | 模型目录最多列多少个（按发布时间倒序） |
| `minModelsPerMetric` | 5 | 少于这个模型数的表不显示，避免"某类别只有 1 个模型"这种误导 |
| `livebench.enabled` | `true` | 关掉就不读 LiveBench |
| `livebench.tableUrlTemplate` / `directoryUrl` | 见文件 | 表格地址模板与目录列表地址；换成镜像或别的基准仓库时改这里 |
| `livebench.fallbackTable` | `table_2026_06_25.csv` | 目录列表不可用时的兜底文件名 |
| `openrouter.enabled` | `true` | 关掉就不读 OpenRouter |
| `json` | `null` | 你自己的榜单来源，见上 |

## 已知边界

- **模型匹配是窄规则，不是模糊猜测**：基准写 `claude-opus-5-5-max-effort`，目录写 `anthropic/claude-opus-5.5`。
  规则是"去掉标点、去掉厂商前缀、去掉 max/effort/thinking 这类运行档位后缀之后名字相同"才算同一个模型
  （`backend/match.ts`，有单测保证 `gpt-6-sol` 不会匹配到 `gpt-6.1-sol`）。匹配不上的行显示「—」，
  不会瞎猜一个价格；写错的行用 `modelAliases` 手工纠正，页面上会显示匹配上的行数供你核对。
- **模型名显示**：分数表按基准自己的 id 显示，做了一层只用于显示的格式化（`GLM`、`GPT` 这类缩写会大写），
  原始 id 保留在单元格的 `title` 里。
- **价格口径**：OpenRouter 的接口是"每 token 美元"，页面换算成**每百万 token**；接口用负数表示
  "价格不定"（路由类模型），这种值按"未知"处理，不会显示成负价格。
- 页面上的"数据更新于"是本次读取的时间；每个来源的具体版本（例如 LiveBench 的表格日期）单独标出。
