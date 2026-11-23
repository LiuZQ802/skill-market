# 常用工具超市

我的常用工具集合：按"类型"和"分类"浏览，一键复制链接，点名称直达 GitHub 仓库。纯静态页面，无需构建。
目前收录的类型是 Skills，之后可以在页面顶部点"+ 新类型"添加提示词、MCP、网站等。

## 功能
- 类型 > 分类两级浏览，每个类型有自己的分类，支持搜索（按 `/` 聚焦）
- 同一仓库的多个 skill 合并成一张"系列"卡片（nature-skills、CCFA-Skills 等），点"展开"查看成员；系列名称、简介都可编辑，添加时可选择所属系列
- 每张卡片有中文简介；"复制链接"复制原始文件链接，名称和"查看仓库"跳到 GitHub（多 skill 仓库直达对应目录）
- 排行榜：按复制次数排序（见下方"统计服务"）
- "置顶"后出现在"常用"分类
- 粘贴 GitHub 的 blob / tree / raw 链接即可添加，自动转 raw 链接并尝试读取名称和简介；其他网站的链接原样保存
- 数据保存在浏览器 localStorage，可导出 / 导入 JSON 备份
- 明暗主题跟随系统

## 本地运行
```bash
npx serve .
```
不要直接双击 `index.html`（浏览器会拦截读取 `data/items.json`）。

## 预置数据
`node scripts/build-seed.mjs` 会从 GitHub 读取各 skill 的信息并生成 `data/items.json`（需已登录 `gh`）。
中文简介写在 `scripts/descs.json`，也可以直接手改 `data/items.json`，提交后对所有设备生效。

## 统计服务（可选）
不配置时，排行榜只统计本机的复制次数。要显示所有人的次数，部署 `worker/` 里的 Cloudflare Worker，
再把地址填进 `config.js`，详见 [worker/README.md](worker/README.md)。
