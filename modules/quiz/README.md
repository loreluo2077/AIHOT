# 测验模块

eva-s-fomo-finder 的两个测验**合并成一个入口**：`/fomo-test` 一页内切换「AI 生存指数」（10 题）与
「AI 焦虑速测」（5 题），页面用 fomo 模块的赛博皮肤（`@aihot/fomo/web/cyber.css`，因此 `package.json`
依赖 `@aihot/fomo`）。题库与等级迁自原项目的 `src/data/*.ts`，文案原样保留；原项目里的昵称/行业登记
与演示排行榜**没有迁**——这里不存任何东西。

- 题目与打分是静态数据（`data/`），**分数只在浏览器里算**：没有接口、没有表、没有排程，也不上传任何内容。
- 两份测试各自独立：测完的结果在切换后保留；做到一半切走的那份会从头开始（两份题都很短）。
- 结果互相导流：速测结果 → 「深度 AI 生存测试」，生存测试 → 「测测你的焦虑值」。
- 入口：桌面侧栏「指数」分区一行（「FOMO 自测」）+ 手机端「我的」页一行 + 站点首页（`/`，今日FOMO）的 CTA。
- 旧的 `/anxiety-test` 路径随合并取消（引擎的模块路由不支持重定向，旧链接会 404）。

## 改题库

编辑 `data/fomo-quiz.ts` / `data/anxiety-quiz.ts`：每题 4 个选项、分值 1/4/7/10；
生存测试 10 题总分 100，每个维度恰好 2 题；速测 5 题总分 50。
`tests/quiz.standalone.test.ts` 盯着这些形状——改了题库跑一遍它。

## 关掉或删掉它

1. 只从导航里拿掉：删 `web.tsx` 里的 `sidebar` 与 `tools` 两项（页面还在，只是没有入口）。
2. 完全不装：`site/modules/{index,web}.ts` 里的 `quiz` 行删掉、`site/package.json` 与
   `Dockerfile` 的对应行删掉，再删 `modules/quiz/`。没有表，数据库不用动；对 `@aihot/fomo`
   的依赖只剩 CSS，fomo 在时不用动。
