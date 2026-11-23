// 生成 data/skills.json 的预置数据。运行: node scripts/build-seed.mjs
import { writeFileSync } from "node:fs";

const categories = [
  { id: "writing", name: "写作" },
  { id: "research", name: "科研" },
  { id: "docs", name: "PPT 与文档" },
  { id: "design", name: "设计" },
  { id: "dev", name: "开发" },
];

const A = "anthropics/skills", K = "K-Dense-AI/claude-scientific-skills", T = "Leonxlnx/taste-skill";
const s = (repo, dir, name, category, desc) => ({
  id: `${repo.split("/")[1]}-${name}`, type: "skill", name, category, desc,
  repo, url: `https://raw.githubusercontent.com/${repo}/main/${dir}/${name}/SKILL.md`,
});

const skills = [
  s(A, "skills", "doc-coauthoring", "writing", "与 Claude 分阶段共同撰写文档、提案、技术规范。"),
  s(A, "skills", "internal-comms", "writing", "撰写周报、公告、FAQ、项目更新等内部沟通材料。"),
  s(K, "skills", "scientific-writing", "writing", "撰写科研论文的结构、段落与引用规范。"),
  s(K, "skills", "literature-review", "research", "系统性文献检索、筛选与综述撰写。"),
  s(K, "skills", "citation-management", "research", "管理参考文献，生成并校验 BibTeX 与引用格式。"),
  s(K, "skills", "peer-review", "research", "以审稿人视角审阅论文，给出结构化意见。"),
  s(K, "skills", "hypothesis-generation", "research", "基于已有证据提出并梳理可检验的研究假设。"),
  s(K, "skills", "scientific-critical-thinking", "research", "评估研究设计、证据强度与潜在偏倚。"),
  s(K, "skills", "statistical-analysis", "research", "选择统计方法，完成检验、效应量与结果报告。"),
  s(K, "skills", "research-grants", "research", "撰写基金申请书，对齐评审标准与预算说明。"),
  s(K, "skills", "paper-lookup", "research", "按主题或标题检索论文并核对元数据。"),
  s(K, "skills", "scholar-evaluation", "research", "对学术工作做结构化质量评估。"),
  s(A, "skills", "pptx", "docs", "创建、读取、编辑 PowerPoint 演示文稿。"),
  s(A, "skills", "docx", "docs", "创建、读取、编辑 Word 文档，支持修订与批注。"),
  s(A, "skills", "xlsx", "docs", "处理 Excel 表格：公式、格式、图表与数据清洗。"),
  s(A, "skills", "pdf", "docs", "提取、合并、拆分、填写与生成 PDF。"),
  s(A, "skills", "frontend-design", "design", "生成风格鲜明、可上线的前端界面。"),
  s(A, "skills", "canvas-design", "design", "用设计理念生成海报、视觉稿等静态作品。"),
  s(A, "skills", "theme-factory", "design", "为幻灯片、文档、页面套用预设主题与配色。"),
  s(A, "skills", "brand-guidelines", "design", "按品牌色与字体规范统一产出物外观。"),
  s(A, "skills", "algorithmic-art", "design", "用 p5.js 生成算法艺术与生成式图形。"),
  s(T, "skills", "taste-skill", "design", "反套路前端技能，避免模板味的落地页与作品集。"),
  s(A, "skills", "mcp-builder", "dev", "构建高质量的 MCP 服务，对接外部 API。"),
  s(A, "skills", "webapp-testing", "dev", "用 Playwright 测试并调试本地 Web 应用。"),
  s(A, "skills", "web-artifacts-builder", "dev", "构建多组件的 React + Tailwind HTML 作品。"),
  s(A, "skills", "claude-api", "dev", "使用 Claude API 与 Anthropic SDK 的参考。"),
  s(A, "skills", "skill-creator", "dev", "创建、修改并评测自己的 skill。"),
];

writeFileSync(new URL("../data/skills.json", import.meta.url),
  JSON.stringify({ version: 1, categories, skills }, null, 2) + "\n");
console.log(`wrote ${skills.length} skills`);
