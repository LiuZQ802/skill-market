# 复制次数统计服务

让排行榜显示"所有人"的复制次数。不部署也能用,只是排行榜只统计你本机。

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create KV     # 把输出的 id 填进 wrangler.toml
npx wrangler deploy                      # 得到 https://tool-market-counter.<你的子域>.workers.dev
```

然后把该地址填进仓库根目录 `config.js` 的 `counterApi` 并提交。

- 同一 IP 对同一链接 6 小时内只记一次,避免刷榜。
- 免费版 KV 每天 1000 次写入,每次计数写 2 次,约 500 次复制/天,个人使用足够。
- 如果换了 Pages 域名,同步修改 `worker.js` 顶部的 `ORIGINS`。
