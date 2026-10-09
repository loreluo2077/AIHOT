# 焦虑指数模块

把 ai-fomo 原来的「FOMO 指数」重做成这个站的一个真功能：**指数由当天真实的内容强度打底，读者投票只做修正**。
原来那个版本是自己投自己算，谁刷谁高；这里的下限是本站当天真正选出来的东西。

- 页面：`/fomo`（桌面侧栏自己的「指数」分区；手机底部标签栏的「指数」——标签栏只支持 5 列，这一个模块标签给了它）
- 同一分区的另外两页（本批新增，迁自 eva-s-fomo-finder）：
  - `/timeline` **大事记**：最近 14 天，每天一行——当天的指数、选出条数/事件数/来源数，以及当天评分最高的报道（链到 `/items/:id`）。
    数据来自 `GET /api/fomo/insights`，其中"每天的 top 报道"走公开读层新函数 `publication/activity.ts` 的 `dayTopReports(day, limit)`。
  - `/trends` **趋势**：指数近 30 天走势 + 最近 7 天产出节奏（都来自 insights）+ 主题热度 TOP 12（读引擎公开接口 `/api/site/topics`，按近 30 天选出量排序）。
- 页面下部还有**「什么是 AI FOMO？」**静态说明区块（迁自 eva 的 WhatIsFOMO，文案原样保留）。
- 首页入口：顶部一张**深色指数卡**（`web/home-card.tsx`，走引擎的模块首页插口 `WebModule.home.card`）：
  当天的数字、量尺与三档刻度，可以直接在首页投票，「完整指数 →」进 `/fomo`。
  它和 `/fomo` 页头共用一套视觉（`web/card.tsx`）：固定深底、白字、
  量尺的绿→黄→红用的是引擎的 `ok / amber / hot`——这是站点里唯一一处深色卡，是有意的识别。
- 后台页：`/admin/fomo-signals`（社区信号的恢复与删除）
- 接口：`GET /api/fomo/today`（公开只读）、`GET /api/fomo/insights`（大事记与趋势页共用）、
  `POST /api/fomo/vote`、`POST /api/fomo/hotword`、
  `POST /api/fomo/signal`、`POST /api/fomo/agree`、`POST /api/fomo/report`；
  后台自己的三个在 `/api/admin/fomo/signals*`
- 页面上还有**分享**（分享到 X / 复制指数 / 复制链接 / 保存分享图 / 系统分享）与**关注 X**；
  分享图是 `/og/pages/fomo.png`（文案在 `site/site.ts` 的 `CARDS.fomo`），X 地址在 `config.ts` 的 `share.xProfile`

## 指数怎么算

```
内容强度 C（0–100）
  = 40% × 精选条数 + 25% × 独立事件数 + 20% × 一手来源占比 + 15% × 平均评分
    每一项「达到满分线」得满分；满分线 = 该项固定下限 与 本站最近 30 天的 90 分位 里更高的那个

读者情绪 V（0–100）= 投票加权平均（还好 35 / 有点焦虑 65 / 很焦虑 90）

今日指数 = 60% × C + 40% × V        （当天还没有投票时 = C，页面会写明）
分档：0–40 冷静 · 41–70 躁动 · 71–100 恐慌
```

两个设计上的选择，都是有意的：

- **满分线用的是本站最近 30 天，不是写死的数字。** 站变忙了，指数不会跟着整体虚高；
  而 30 天的窗口**不含今天**，所以忙碌的一天不会抬高自己的门槛。
- **没有投票时指数等于 C，而不是打折。** 一个没人投票的日子不该看起来"很平静"。

内容那一半只统计**公开且已选**的报道（走 `publication/activity.ts` 的公开读取层），撤选或下架的条目
立刻不再计入——和站上其他公开出口同一套可见性规则。

## 热词从哪来

- **今天的热词**：当天精选条目自己带的标签与分类，出现得越多排得越前。不是从正文里瞎猜词。
- **读者补充**：读者提交的词，一人一个词一天算一次；同一个词的不同大小写合并，显示第一次出现的写法。

## 社区信号（读者自己发的一段话）

页面下半部分：读者写一句自己看到/听到/担心的事，别人可以**认同**或**举报**。

- 长度 2–200 字；一人 **5 分钟一条、一天 5 条**；署名选填（最长 24 字），不填显示「匿名」。
- 认同一人一次（同一个信号点两次只算一次）。
- **举报到 2 个不同的人就自动下架**，等站长在后台看一眼（阈值在 `config.ts` 的 `signal.reportsToHide`）。
- 站长在 **后台「社区信号」页**（`/admin/fomo-signals`）恢复或删除；恢复会清掉举报记录。
  导航上的角标数是"已下架、等着看"的条数，和引擎其他角标一个意思。
- 后台接口（`/api/admin/fomo/signals*`）走**引擎同一套会话与 CSRF 校验**（`sessionPrincipal` + 会话里的 csrf），
  没有会话一律 401，写操作缺 CSRF 一律 403——有测试盯着这两件事。

这是全站唯一一块用户生成内容，所以限制都写得紧；第一版不提供"先审后发"，
因为站点小，自动下架 + 人工恢复比让每条都排队更实际。

## 读者提交的防刷

- 投票：**一人一天一票**（同一天再投就是改票），主键 `(day, voter)` 天然保证。
- 热词：一人一天 5 个。
- 社区信号：一人 5 分钟一条、一天 5 条，举报到阈值自动下架。
- `voter` 不是 IP，是引擎反馈系统那套 **HMAC(网络地址 + 站点密钥)** 的不可还原标识，全站一个读者一个标识。
  **不存原始 IP**（见 `site/pages/privacy.md` 第 3 节）。
- 读者能写的只有这三处（票、词、信号），其余接口只读。

## 表

| 表 | 作用 |
|---|---|
| `fomo_votes` | 每天的票，主键 `(day, voter)` |
| `fomo_hotwords` | 读者补充的词，主键 `(day, word, voter)` |
| `fomo_signals` | 读者发的内容，`hidden` / `hidden_reason` 记录它为什么不在页面上 |
| `fomo_signal_marks` | 一个读者对一个信号做过的动作（`agree` / `report`），主键 `(signal_id, voter, kind)` |

**内容那一半没有表、也没有定时任务**：指数在读取时从引擎自己的表现算（几条聚合查询），所以不存在
"快照和真实情况不一致"的问题，worker 不跑也能看。迁移随 `npm run db:migrate` 一起执行。

## 排程与告警

没有。这个模块不注册定时任务，也不产生告警——没有需要保持同步的状态。

## 设置（`config.ts`）

| 字段 | 默认 | 说明 |
|---|---|---|
| `weights` | `{ content: 0.6, votes: 0.4 }` | 两半的权重 |
| `factors` | 见文件 | 内容那一半四项的权重，四者之和必须是 1 |
| `reference` | `{ selected: 8, stories: 5, firstPartyRatio: 0.2 }` | 三项的固定下限（满分线） |
| `baselineDays` / `baselineMinimumDays` | 30 / 7 | 回看多少天、够多少天才用 90 分位抬高下限 |
| `feelings` | `35 / 65 / 90` | 三个投票选项各值多少分 |
| `bands` | 40 / 70 / 100 | 三档的上限 |
| `trendDays` | 14 | 页面上画多少天的历史 |
| `hotword.limit` / `perDay` / `blocked` | 24 / 5 / 见文件 | 榜的长度、一人一天的额度、拒收的泛词 |
| `signal.minLength` / `maxLength` | 2 / 200 | 社区信号的长度 |
| `signal.cooldownSeconds` / `perDay` | 300 / 5 | 一人多久能发一条、一天几条 |
| `signal.reportsToHide` | 2 | 几个不同的人举报就自动下架 |
| `signal.listLimit` | 30 | 页面显示多少条 |
| `share.xProfile` | `null` | 你的 X 地址；填了页面下部才出现「关注 X」按钮 |

## 关掉或删掉它

1. 只想从导航里拿掉：删 `modules/fomo/web.tsx` 里的 `sidebar` 与 `tabs` 两项（页面还在，只是没有入口）。
   首页那张卡是 `home` 一项，删掉它首页就不再显示；大事记/趋势是 `sidebar.items` 里的两行。
2. 只想去掉大事记/趋势两页：删 `modules/fomo/module.ts` 里那两个 page、两个 `web/{timeline,trends}.tsx`、
   `server.ts` 里 `/api/fomo/insights` 路由（`/fomo` 与首页卡不受影响）。`activity.ts` 的
   `dayTopReports` 只有大废记用，可一并删。
3. 只想要投票和热词、不想要社区信号：删 `modules/fomo/module.ts` 里的 `adminPages`，
   再删 `server.ts` 里的 `/api/fomo/signal`、`/api/fomo/agree`、`/api/fomo/report` 与三个 `/api/admin/fomo/*`
   路由，页面里去掉 `Signals` 那一块。
4. 完全不装：`site/modules/{index,server,web}.ts` 三处的 `fomo` 行删掉，`site/package.json` 与
   `Dockerfile` 里的对应行删掉，再删 `modules/fomo/`。
5. 库里还剩四张表与它们的数据：另写迁移逐个 `DROP TABLE IF EXISTS`（先 `fomo_signal_marks`，它引用 `fomo_signals`）。
6. 公开读取层的 `publication/activity.ts` 是通用的"每天发生了什么"，别的功能也能用；没有别处用它时，
   连同 `modules/fomo/backend/read.ts` 一起删。

## 已知边界

- 指数衡量的是"本站今天选出/报道了多少、读者感觉如何"，**只描述热度，不评价任何公司或事件**。
- 一手来源占比依赖信源的 `first_party` 标记，信源没标过就会偏低。
- 投票与信号都是匿名的、按天/按标识算的：同一个人换浏览器或换网络会被算成两个人。这里不追求精确身份，只防刷量。
- 30 天窗口内在镜像导入之前的日子里，满分线会停在 `reference` 的固定下限上。
- 社区信号**先发后审**（自动下架 + 人工恢复）；没有关键词过滤，也没有排队审核。
- 后台的下架接口没有做"版本号"乐观锁：同一秒里两次操作按后到的算。
