// 从 GitHub 收藏的 skill 仓库生成 data/items.json(需已登录 gh)。运行: node scripts/build-seed.mjs
import { writeFileSync, readFileSync } from "node:fs";
const DESCS = JSON.parse(readFileSync(new URL("./descs.json", import.meta.url), "utf8"));
import { execFileSync } from "node:child_process";

const types = [{ id: "skill", name: "Skills", noun: "Skill" }];
const categories = [
  { id: "writing", name: "写作", type: "skill" },
  { id: "research", name: "科研", type: "skill" },
  { id: "ppt", name: "PPT", type: "skill" },
  { id: "design", name: "设计", type: "skill" },
  { id: "plot", name: "绘图", type: "skill" },
];

// [repo, SKILL.md 所在目录("" 表示根目录), 分类]
const src = [
  ["rc8s2242sr-cmd/writing-order", "", "writing"],
  ["blader/humanizer", "", "writing"],
  ["pbakaus/impeccable", "plugin/skills/impeccable", "design"],
  ["ifeihong/feihong-design-system", "", "design"],
  ["helloo1568/slidemuse", "", "ppt"],
  ["hugohe3/ppt-master", "skills/ppt-master", "ppt"],
  ["liouhai/plot-is-all-you-need", "skills/plot", "plot"],
  ["liouhai/plot-is-all-you-need", "skills/collect", "plot"],
  ...["nature-academic-search","nature-citation","nature-data","nature-downloader","nature-experiment-log","nature-literature-pipeline","nature-paper-card","nature-paper-to-patent","nature-paper-trans","nature-paper-xray","nature-polishing","nature-proposal-writer","nature-reader","nature-ref-verifier","nature-response","nature-reviewer","nature-social-science","nature-statistics","nature-writing"]
    .map(n => ["Yuan1z0825/nature-skills", `skills/${n}`, /writing|polishing|response|proposal/.test(n) ? "writing" : "research"]),
  ["Yuan1z0825/nature-skills", "skills/nature-figure", "plot"],
  ["Yuan1z0825/nature-skills", "skills/nature-paper2ppt", "ppt"],
  ["Yuan1z0825/nature-skills", "skills/nature-image2ppt", "ppt"],
  ["Yuan1z0825/nature-skills", "skills/nature-paper2word", "writing"],
  ...["ccf-experiment-designer","ccf-idea-optimizer","ccf-idea-reviewer","ccf-integrity-auditor","ccf-literature-monitor","ccf-literature-searcher","ccf-paper-reviewer","ccf-paper-to-exemplar","ccf-paper-writer","ccf-pipeline-orchestrator","ccf-project-scaffolder","ccf-rebuttal-writer","ccf-research-engineer","ccf-skill-forger","ccf-submission-checker","ccf-visual-composer","ccf-humanization"]
    .map(n => ["mikubaka88/CCFA-Skills", n, /writer|rebuttal|humanization/.test(n) ? "writing" : n === "ccf-visual-composer" ? "plot" : "research"]),
];

const branch = {};
const gh = (...a) => execFileSync("gh", a, { encoding: "utf8", maxBuffer: 1 << 24 });

function frontmatter(text) {
  const m = text.replace(/^﻿/, "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  const L = m[1].split(/\r?\n/);
  for (let i = 0; i < L.length; i++) {
    const kv = L[i].match(/^(name|description):\s*(.*)$/); if (!kv) continue;
    let v = kv[2].trim();
    if (/^[>|][+-]?$/.test(v)) { v = ""; while (i + 1 < L.length && /^\s+/.test(L[i + 1])) v += " " + L[++i].trim(); }
    out[kv[1]] = v.replace(/^["']|["']$/g, "").trim();
  }
  return out;
}
const clip = (s, n = 400) => { s = s.replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

const starCache = {};
const stars = async r => (starCache[r] ??= Number(gh("api", `repos/${r}`, "--jq", ".stargazers_count")));
const skills = [];
for (const [repo, dir, category] of src) {
  branch[repo] ??= gh("api", `repos/${repo}`, "--jq", ".default_branch").trim();
  const path = (dir ? dir + "/" : "") + "SKILL.md";
  let fm = {};
  try { fm = frontmatter(Buffer.from(JSON.parse(gh("api", `repos/${repo}/contents/${path}`)).content, "base64").toString("utf8")); }
  catch (e) { console.warn("读取失败", repo, path); }
  const name = fm.name || dir.split("/").pop() || repo.split("/")[1];
  const id = `${repo.split("/")[1]}-${dir.split("/").pop() || "root"}`;
  if (!DESCS[id]) console.warn("缺少中文简介", id);
  skills.push({
    id, type: "skill", name, category,
    desc: DESCS[id] || clip(fm.description || "", 120), repo, stars: await stars(repo),
    url: `https://raw.githubusercontent.com/${repo}/${branch[repo]}/${path}`,
  });
}
writeFileSync(new URL("../data/items.json", import.meta.url), JSON.stringify({ version: 2, types, categories, skills }, null, 2) + "\n");
console.log(`wrote ${skills.length} skills`);
