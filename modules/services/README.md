# AI 服务模块

一个介绍页：把自己在用、也愿意推荐的 AI 服务（接口中转、工具、托管之类）列成卡片，点进去是各自的站点。
**这里不卖东西，也不接支付**——没有数据库、没有接口、没有定时任务，页面完全由 `config.ts` 里的一个数组长出来。

- 页面：`/tools`（桌面侧栏「内容」里的一项；手机上在「我的」页里——底部标签栏的 5 列被焦虑指数占了。
  页面路径从 `/services` 改成了 `/tools`，模块名仍是 `services`）

## 怎么加一条

打开 `config.ts`，往 `entries` 里加：

```ts
entries: [
  {
    name: "某某中转",
    summary: "一个 OpenAI 兼容的接口地址，按量计费。",
    url: "https://example.com",
    badge: "自有服务",       // 选填
    price: "约 $1 / 百万 token 起",  // 选填；不确定就别写
  },
],
```

数组为空时，页面会显示一句说明，并告诉你去哪个文件填。改完重新构建网页（本机 `npm run dev -w @aihot/web`，
线上 `docker compose up -d --build`）即可生效。

## 页面上会说明的事

`note` 会显示在卡片列表下面：这些服务由各自的运营者提供与销售，本站不是提供方、不参与交易，
价格与可用性以对方页面为准。使用规则页（`site/pages/terms.md` 第 6 节）和隐私说明页也写了同一件事——
加了新服务时，那两页不用改。

## 关掉或删掉它

1. 只想从导航里拿掉：删 `modules/services/web.tsx` 里的 `sidebar` 与 `tools` 两项（页面还在，只是没有入口）。
2. 完全不装：`site/modules/{index,web}.ts` 两处的 `services` 行删掉，`site/package.json` 与
   `Dockerfile` 里的对应行删掉，再删 `modules/services/`。
3. 没有表，也没有数据要清。

## 已知边界

- 页面上的链接是普通外链，不做跳转中转、不埋点、不带推荐参数。
- 卡片顺序就是 `entries` 的顺序；没有排序、分类或搜索——条目少的时候不需要。
