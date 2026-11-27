// 给 data/items.json 里的每个条目建一个计数附件(GitHub Release 附件的下载次数就是复制次数)。
// 新增预置条目后运行: node scripts/sync-counters.mjs   (需已登录 gh)
// 只补缺失的附件。不要删除或覆盖已有附件,否则它的次数会清零。
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = "LiuZQ802/skill-market", TAG = "counters";
const gh = (...a) => execFileSync("gh", a, { encoding: "utf8", maxBuffer: 1 << 24, stdio: ["ignore", "pipe", "pipe"] });

const { skills } = JSON.parse(readFileSync(new URL("../data/items.json", import.meta.url), "utf8"));
const wanted = skills.filter(s => s.kind !== "group").map(s => `${s.id}.txt`);
const bad = wanted.filter(n => !/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(n));
if (bad.length) throw new Error("这些 id 不能用作附件名: " + bad.join(", "));

// 读取失败时直接报错退出,只有确认 Release 不存在才新建
const releases = JSON.parse(gh("api", `repos/${REPO}/releases?per_page=100`));
let release = releases.find(r => r.tag_name === TAG);
if (!release) {
  gh("release", "create", TAG, "--repo", REPO, "--prerelease", "--title", "复制次数计数器",
    "--notes", "网站用这些附件的下载次数统计复制次数。请不要删除或重新上传附件,否则次数会清零。");
  release = { assets: [] };
}
const have = new Set(release.assets.map(a => a.name));
const missing = wanted.filter(n => !have.has(n));

if (missing.length) {
  const dir = mkdtempSync(join(tmpdir(), "counters-"));
  const files = missing.map(n => { const p = join(dir, n); writeFileSync(p, "1"); return p; });
  for (let i = 0; i < files.length; i += 10) gh("release", "upload", TAG, ...files.slice(i, i + 10), "--repo", REPO);
  rmSync(dir, { recursive: true, force: true });
}
console.log(`需要 ${wanted.length} 个,新建 ${missing.length} 个`);
