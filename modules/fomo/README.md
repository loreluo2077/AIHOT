# FOMO 模块

eva-s-fomo-finder 的体验在引擎上的落地：**首页复刻原项目的赛博朋克首页并坐在站点根路径 `/` 上**，页面中部是
当天真实的焦虑指数。指数只剩内容那一半——读者墙与心情投票都只活在浏览器里，不再有后端写入。

- 页面：
  - `/` **今日FOMO**：复刻 eva 的 Index 页——轮播四张「刺激卡」的 Hero（视差网格、霓虹闪烁、故障动画）、
    **今日指数**（服务端读 `/api/fomo/today`：计数动画、分档量尺、当天四项数字；api 不可用时显示占位而不挂页）、
    「什么是 AI FOMO」科普、心情投票（本地计数）、留言墙（localStorage，只存在这台浏览器）与静态 feed 卡。
    CTA 进 `/fomo-test`（合并自测）。**引擎的精选流让出了根路径，住在 `/featured`**。
  - `/fomo-test` **FOMO 自测**：见 quiz 模块（`modules/quiz`）。
- 皮肤：`web/cyber.css`——固定深色（黄/青/品红霓虹），不随读者主题；quiz 模块的自测页也 import 它
  （`package.json` 里导出 `./web/cyber.css`，`sideEffects` 只放行 CSS）。
- 接口只剩一个公开只读：`GET /api/fomo/today`。
- 已下线页面的旧地址由模块重定向接到首页：`/fomo`、`/timeline`、`/trends` 都 301 → `/`。

## 指数怎么算

```
今日指数 C（0–100）
  = 40% × 精选条数 + 25% × 独立事件数 + 20% × 一手来源占比 + 15% × 平均评分
    每一项「达到满分线」得满分；满分线 = 该项固定下限 与 本站最近 30 天的 90 分位 里更高的那个

分档：0–40 冷静 · 41–70 躁动 · 71–100 恐慌
```

两个设计上的选择，都是有意的：

- **满分线用的是本站最近 30 天，不是写死的数字。** 站变忙了，指数不会跟着整体虚高；
  而 30 天的窗口**不含今天**，所以忙碌的一天不会抬高自己的门槛。
- 指数只统计**公开且已选**的报道（走 `publication/activity.ts` 的公开读取层），撤选或下架的条目
  立刻不再计入——和站上其他公开出口同一套可见性规则。

## 静态部分的取舍

留言墙与投票照搬 eva 的做法：**只存在 localStorage**，不上传、别人看不到（key 是 `aifomo-voices`）；
投票的计数是写死的演示数字，页面明说「别当真」。原来的真实投票/信号墙已删——`fomo_votes`、`fomo_hotwords`、
`fomo_signals`、`fomo_signal_marks` 四张表由迁移 `0114–0117` 逐张 `DROP`（先 marks 后 signals，外键顺序）。
**已存的读者数据会随迁移丢掉**，更新说明写在 `docs/deploy.md`。

## 设置（`config.ts`）

| 字段 | 默认 | 说明 |
|---|---|---|
| `factors` | 见文件 | 四项的权重，四者之和必须是 1 |
| `reference` | `{ selected: 8, stories: 5, firstPartyRatio: 0.2 }` | 三项的固定下限（满分线） |
| `baselineDays` / `baselineMinimumDays` | 30 / 7 | 回看多少天、够多少天才用 90 分位抬高下限 |
| `bands` | 40 / 70 / 100 | 三档的上限 |
| `cacheSeconds` | 120 | 接口的缓存时长 |

## 关掉或删掉它

1. 只想从导航里拿掉：删 `modules/fomo/web.tsx` 里的 `sidebar` 与 `tabs` 两项（页面还在，只是没有入口）。
2. 不想让首页是它：把 `apps/web/app/routes.ts` 的 `index(...)` 换回 `routes/home.tsx`（精选流回根路径），
   再把 `module.ts` 的 pages 加回 `{ path: "fomo", file: "web/fomo.tsx" }`、删掉那条重定向。
3. 完全不装：`site/modules/{index,server,web}.ts` 三处的 `fomo` 行删掉，`site/package.json` 与
   `Dockerfile` 里的对应行删掉，再删 `modules/fomo/`；quiz 的自测页 import 了 `web/cyber.css`，
   一并处理（见 quiz 的 README）。没有表了，数据库不用动。

## 已知边界

- 指数衡量的是"本站今天选出/报道了多少"，**只描述热度，不评价任何公司或事件**。
- 一手来源占比依赖信源的 `first_party` 标记，信源没标过就会偏低。
- 首页的留言墙与投票是纯前端演示：换浏览器/清存储就没了，这是有意的（与原型一致）。
- 30 天窗口内在镜像导入之前的日子里，满分线会停在 `reference` 的固定下限上。
