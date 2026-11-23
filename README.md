# Skill 超市

个人常用 Skill 的"超市"：按分类浏览，一键复制 SKILL.md 的原始（raw）链接。纯静态页面，无需构建。

## 功能
- 分类浏览（写作 / 科研 / PPT 与文档 / 设计 / 开发），支持搜索（按 `/` 聚焦）
- 一键复制原始链接；"置顶"后会出现在"常用"分类
- 动态添加：粘贴 GitHub 的 blob / tree / raw 链接，自动转成 raw 链接并尝试读取名称与简介
- 编辑、移除、新建分类；数据保存在浏览器 localStorage，可导出 / 导入 JSON 备份
- 明暗主题，跟随系统，可手动切换

## 本地运行
```bash
npx serve .
```
不要直接双击 `index.html`（浏览器会拦截读取 `data/skills.json`）。

## 预置数据
编辑 `scripts/build-seed.mjs` 后运行 `node scripts/build-seed.mjs` 重新生成 `data/skills.json`，或直接手改 JSON，提交后即对所有设备生效。

## 以后扩展到其他类型
`app.js` 顶部的 `TYPES` 增加一项（如提示词、MCP），数据条目写上对应的 `type` 即可，顶部会自动出现新的标签页。
