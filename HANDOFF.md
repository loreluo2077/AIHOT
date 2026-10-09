# 交接文档：AIHOT（AI FOMO 站点）

> 写给下一个接手的 AI Agent。写于 2026-10-09，作者：上一个 Agent（cardai-glm / GLM）。
> **这份文档取代工作区根目录那份旧的 `HANDOFF.md`**——那份描述的"ai-fomo 原型迁入 AIHOT"方向已经被使用者
> 推翻，现在真正的方向见第 2 节：**功能来源是 `eva-s-fomo-finder`，不是 `ai-fomo/` 原型**。

---

## 0. 一句话现状

AIHOT（`dev` 分支，HEAD `aa51e10`）已改造成 **AI FOMO** 站点：引擎内容管道（采集→模型筛选→日报/热点/主题）
之上，用引擎自己的风格落地了 eva-s-fomo-finder 的核心功能——焦虑指数+投票、大事记、趋势、两个心理测验、
共鸣墙、热词、AI 服务页。**全部改动仍未提交**（25+ 路径，见第 9 节），测试 732/732 全绿，站点本机可跑。

---

## 1. 三个目录，谁是谁

| 路径 | 是什么 | 状态 |
|---|---|---|
| `AIHOT/`（本目录） | **主项目**。行业热点引擎 + AI FOMO 功能层 | `dev` 分支，全部改动未提交 |
| `../eva-s-fomo-finder/` | **功能来源**（使用者的真项目）。Lovable 构建的 Vite+React+shadcn+Supabase EVA 风原型 | Git 干净，`main` 与 origin 同步；**只读参考 + 功能清单**，代码不直接搬 |
| `../ai-fomo/` | 更早的英文原型（Next.js，内存数据）。它的功能已全部被上面两条覆盖 | 只读参考，可忽略 |

工作区根还有：`aihot-backup-2026-10-09/` 与 `.tar.gz`（回滚前的完整备份，第 8 节）、`MERGE-PLAN.md`（旧方案，过时）。

**历史脉络别再绕**：上一任把 `ai-fomo/` 原型迁进来 → 使用者说"不对" → 问清楚后真相是使用者真正想迁的是
`eva-s-fomo-finder` 的功能，且**不要 EVA 皮肤、保持引擎风格、不迁登录、只中文**。本批已按此做完并回滚重建过一次。
**别再提议 EVA 风 / Supabase / 迁登录 / 双语，使用者已明确否了**（见 `docs/site-changes.md` 第 10.5 节）。

---

## 2. 站点功能地图（改完别漏看这里的对应关系）

| 页面 | 模块 | 数据 |
|---|---|---|
| `/` 首页 | 引擎精选流 + `modules/fomo` 的深色指数卡（`WebModule.home.card` 插口，引擎 `apps/web/app/modules.ts` + `routes/home.tsx`） | 卡片客户端 fetch `/api/fomo/today`，可直投 |
| `/fomo` 焦虑指数 | `modules/fomo` | 指数=60% 内容强度+40% 读者情绪；表 `fomo_votes/hotwords/signals/signal_marks` |
| `/timeline` 大事记 | `modules/fomo/web/timeline.tsx` | `GET /api/fomo/insights`：每天指数+选出数+当日最高分报道（读层 `activity.ts` 的 `dayTopReports`） |
| `/trends` 趋势 | `modules/fomo/web/trends.tsx` | 同 insights + 引擎 `/api/site/topics`（主题热度 TOP 12） |
| `/fomo-test`、`/anxiety-test` 测验 | **`modules/quiz`**（新） | 纯前端：题库在 `data/`，浏览器算分，**零存储零接口** |
| `/tools` AI 服务 | `modules/services`（路径已从 `/services` 改名） | 纯配置：`config.ts` 的 `entries`（**空，等使用者给清单**） |
| `/leaderboard` 模型榜 | `modules/leaderboard`（已提交的旧模块） | 每日 06:10 刷新 |
| `/hot` `/daily` `/topics` `/story` 等 | 引擎自带 | 内容管道 |
| `/admin/fomo-signals` | `modules/fomo` 后台 | 共鸣墙的恢复/删除，角标 `fomoSignals` |

导航：桌面侧栏「指数」分区（焦虑指数/大事记/趋势/FOMO 测试/焦虑测试）+「内容」（引擎+AI 服务+模型榜）+「更多」；
手机标签栏第五格「指数」。

---

## 3. 环境（每一条都踩过，别重踩）

| 东西 | 事实 |
|---|---|
| Node | **要 24**：`export PATH=/tmp/n24/current/bin:$PATH`（系统 node v21 跑不了）⚠️ 在 `/tmp`，重启机器就没了 |
| npm | 必须 `--cache /tmp/npm-cache-aifomo`（家目录 npm 缓存有 root 残留文件，直接 install 会 EPERM） |
| 数据库 | Postgres 17，`/tmp/pgdata`，端口 **5433**，socket `/tmp/pgsock`，库 `myhot`；psql 在 `/opt/homebrew/opt/postgresql@17/bin/psql` ⚠️ 同在 `/tmp` |
| Docker | 没装 |
| `ps` | 沙箱禁用；看进程用 `lsof -nP -iTCP:3000 -iTCP:3001 -sTCP:LISTEN` |
| Playwright | 测试缺 chromium-1228：`node --test apps/web/tests/*.test.ts` **永远有 10 个失败**（`navigation-performance.test.ts`），与本仓库改动无关 |
| 密钥 | `AIHOT/.env`（gitignore）：`DATABASE_URL`、`ADMIN_PASSWORD`、`SESSION_SECRET`、`LLM_*` |
| **api 重启** | api 是裸 `node` 起的，**没有 watch**：改了后端必须重启，否则新路由 404、旧代码继续跑（本批踩过） |
| **vite 缓存** | 新增/删除模块页面后重启 web 仍 404：删 `apps/web/node_modules/.vite` 再启动（本批踩过） |

## 4. 怎么跑起来（照抄）

```bash
export PATH=/tmp/n24/current/bin:$PATH
cd /Users/a1/Documents/luoer/ai-fomo/AIHOT
LC_ALL=C pg_ctl -D /tmp/pgdata -o "-p 5433 -k /tmp/pgsock -l /tmp/pg.log" start   # 数据库（若没在跑）
npm run db:migrate                                                                 # 含模块迁移 0110-0113

node --env-file-if-exists=.env apps/api/src/main.ts      # api :3001（后台；改后端后必须重启）
npm run dev -w @aihot/web                                # web :3000（后台；新增模块页后先删 apps/web/node_modules/.vite）
```

检查（全绿才算过）：

```bash
npm run typecheck
DATABASE_URL=postgres://postgres@127.0.0.1:5433/aihot_test npm test      # 732 全过；aihot_test 库要干净（见下）
npm run test:standalone                                                   # 200 全过
npm run build -w @aihot/web && node --test apps/web/tests/*.test.ts       # 32 过/10 失败=Playwright 环境问题
node scripts/smoke.ts --base http://127.0.0.1:3000
```

注意：`npm test` 用的 `aihot_test` 库会残留旧的 `fomo_*` 表，触发架构检查"有表没代码"——
报错时把那四张表从测试库删掉再跑。本机所有请求同源，测试期间全站算同一个读者。

**当前在跑**：api 与 web 都是本会话起的后台进程（lsof 查 PID）。会话结束进程可能随之退出，按上面命令重启即可。

## 5. 改了什么（本批，相对上游 `aa51e10`）

**从备份恢复的**（`../aihot-backup-2026-10-09/`，内容=上一批的 AI FOMO 改造，`docs/site-changes.md` 第 9 节有全表）：
品牌与站点文件（`site/site.ts` 站名 AI FOMO、`site/brand/*`、条款/隐私/changelog）、`modules/{fomo,services}`、
`packages/backend/src/publication/activity.ts`、引擎 home 插口（`apps/web/app/modules.ts`、`routes/home.tsx`）、
`site/modules/*` 注册、模型榜三处顺手修复（og/handle/我的页入口）。

**本批新写的**（迁自 eva-s-fomo-finder）：

| 文件 | 内容 |
|---|---|
| `modules/fomo/web/timeline.tsx`、`web/trends.tsx` | 大事记、趋势两页 |
| `modules/fomo/server.ts` +`GET /api/fomo/insights`；`backend/read.ts` +`fomoInsightsPayload()`；`config.ts` +`trendsDays/timelineDays/timelineTop` | 大事记/趋势的数据 |
| `publication/activity.ts` +`dayTopReports(day, limit)` | 公开读层：某天评分最高的选出报道（大事记用） |
| `modules/fomo/web/fomo.tsx` 底部 | 「什么是 AI FOMO？」静态区块（文案迁自 eva） |
| `modules/quiz/**`（8 个文件，新模块） | 两个测验页+题库（`data/fomo-quiz.ts`、`data/anxiety-quiz.ts`，文案原样）+题库形状测试 4 个+README |
| `modules/services` | 页面 `/services`→`/tools`（module.ts、web.tsx、页面 meta、`CARDS` key 改 `tools`） |
| `site/site.ts` | `CARDS` +`timeline`/`trends` 两张分享图 key |
| `site/modules/{index,web}.ts`、`site/package.json`、`Dockerfile`、`package-lock.json` | 注册 `@aihot/quiz` |
| `docs/site-changes.md` 第 10 节、`modules/{fomo,services,quiz}/README.md` | 文档 |

**明确没迁的**（使用者已拍板，别翻案）：EVA 皮肤（CyberNav/EVAOverlay/赛博配色）、Supabase/登录/创作者资料、
双语 i18n、mock 排行榜与演示数据、html2canvas 客户端分享图（引擎 OG 图够用）。

## 6. 验证过什么（可复现）

- 回滚后基线 696 全绿 → 恢复+新增后 **732/732**、standalone **200/200**、typecheck、build、smoke 全过
- web 测试 32 过/10 失败=预存 Playwright 环境问题（第 3 节）
- 实站：全部新页面 200；侧栏「指数」分区五项齐全；生存测试全流程（10 题→100 分 S 级+五维条形+复制/重测/导流）；
  首页卡投票、`/fomo` 全功能此前批次已实测；测验确认零上传
- 数据：`fomo_*` 四张表 0/0/0/0（测试数据已清）

## 7. 设计决定（替使用者拍的，要改先问）

1. **风格**：全站引擎风格，唯首页指数卡与 `/fomo` 页头是固定深色卡；量尺渐变（ok→amber→hot）是全站唯一渐变，
   属数据编码（三档），`docs/site-changes.md` 9.11 有说明。
2. **大事记的"等级"**：没用 eva 的 CRITICAL/WARNING/INFO 手工分级（没有数据支撑），改为展示每天真实指数+最高分报道。
3. **测验不登录不注册不存储**：结果只在浏览器里；原项目昵称/行业登记省去（没有排行榜就没有意义）。
4. **quiz 独立成模块**（不塞进 fomo）：无后端，删/留都干净。
5. **`/tools`**：模块名仍叫 `services`，只改了页面路径（`entries` 空着等清单）。
6. **指数算法没校准**（权重是拍的，`docs/selection.md` 的规矩是用样本校准）——最该重做的一件事，还没做。

## 8. 回滚与备份

- 备份：`../aihot-backup-2026-10-09/`（未打包目录）+ `../aihot-backup-2026-10-09.tar.gz`（170K，54 文件）。
  含回滚前的全部 25 个改动路径（含品牌二进制与文档）。
- 一次回到干净上游：`git checkout -- . && rm -rf modules/fomo modules/services modules/quiz packages/backend/src/publication/activity.ts &&
  npm install --cache /tmp/npm-cache-aifomo`，再按 `docs/site-changes.md` 9.6/README 清数据库。
- 只关某功能：每个模块 README 的「关掉或删掉它」一节都有逐条步骤。

## 9. 未提交 & 下一步

**工作区一个 commit 都没有**（25+ 路径）。使用者确认效果后建议分批提交
（品牌一个、模块一个、quiz 一个、文档一个），提交前先跑第 4 节全部检查。

使用者说**后面还会继续开发**，已知挂起项按优先级：

1. **真数据**：worker 没跑 → 今天指数/大事记/趋势都是 0。要见数需 `COLLECT_ENABLED`/`MODEL_CALLS_ENABLED=true`
   并跑 worker（**会花模型的钱**，先问使用者）。
2. **等使用者给的东西**：`/tools` 的 `entries` 清单；`share.xProfile`（X 账号）；条款页生效日期/主体/联系方式。
3. **指数权重校准**（见第 7 节第 6 条）。
4. **常驻环境**：Node/PG 都在 `/tmp`（第 3 节），长期用先按 `docs/site-changes.md` 第 4 节换正式环境。
5. 提交与分支整理（`dev` 领先上游；工作区还有未提交改动）。

## 10. 文档索引

| 想知道什么 | 看哪里 |
|---|---|
| 本批（eva 迁入+回滚重建）全部细节 | `docs/site-changes.md` 第 10 节 |
| 之前批次（品牌/指数/服务页/首页卡/修 process.env bug） | `docs/site-changes.md` 第 9 节 |
| 指数算法/表/限流 | `modules/fomo/README.md` |
| 测验题库与改题 | `modules/quiz/README.md` |
| AI 服务页加条目 | `modules/services/README.md` |
| 引擎约定（模块/迁移/读层/检查） | `AGENTS.md`、`docs/{architecture,customize,deploy,selection}.md` |
| 功能来源原型 | `../eva-s-fomo-finder/`（只读；页面在 `src/pages`，数据接口在 `src/hooks/use-content.ts` 与 `supabase/migrations`） |
