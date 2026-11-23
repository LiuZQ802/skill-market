/* Skill 超市: 纯静态前端。
   预置数据来自 data/skills.json,用户的增删改与置顶保存在 localStorage。
   以后要加别的内容类型(提示词、MCP 等),往 TYPES 加一项,并在数据里写 type 即可。 */
(() => {
  "use strict";

  const TYPES = [{ id: "skill", name: "Skills", noun: "Skill" }];
  const STORE = "sm.user.v1";
  const PIN = "pinned", ALL = "all";

  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach(c => c != null && n.append(c));
    return n;
  };

  /* ---------- 状态 ---------- */
  let base = { categories: [], skills: [] };
  let user = load();
  let ui = { type: "skill", cat: ALL, q: "", editing: null };

  function load() {
    const empty = { added: [], overrides: {}, hidden: [], pinned: [], categories: [] };
    try { return { ...empty, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; }
    catch { return empty; }
  }
  const save = () => localStorage.setItem(STORE, JSON.stringify(user));

  const categories = () => [...base.categories, ...user.categories.filter(c => !base.categories.some(b => b.id === c.id))];
  const catName = id => (categories().find(c => c.id === id) || { name: "未分类" }).name;
  const items = () => [
    ...base.skills.filter(s => !user.hidden.includes(s.id)).map(s => ({ ...s, ...(user.overrides[s.id] || {}) })),
    ...user.added,
  ].filter(s => (s.type || "skill") === ui.type);

  /* ---------- 链接处理 ---------- */
  // 把 GitHub 的 blob / tree / 仓库链接统一成 raw 地址
  function toRaw(input) {
    let u;
    try { u = new URL(input.trim()); } catch { return null; }
    const parts = u.pathname.split("/").filter(Boolean);
    if (u.hostname === "raw.githubusercontent.com") return parts.length >= 4 ? u.href : null;
    if (u.hostname !== "github.com" || parts.length < 2) return null;
    const [owner, repo, kind, branch, ...rest] = parts;
    if (kind === "blob" && branch && rest.length) return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`;
    if (kind === "tree" && branch) return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${[...rest, "SKILL.md"].join("/")}`;
    if (!kind) return `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`;
    return null;
  }
  const repoOf = url => { const p = new URL(url).pathname.split("/").filter(Boolean); return p.length >= 2 ? `${p[0]}/${p[1]}` : ""; };
  const nameFromUrl = url => { const p = new URL(url).pathname.split("/").filter(Boolean); const last = p[p.length - 1]; return /\.md$/i.test(last) && p.length > 4 ? (/^skill\.md$/i.test(last) ? p[p.length - 2] : last.replace(/\.md$/i, "")) : last; };

  function parseFrontmatter(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return {};
    const out = {};
    const lines = m[1].split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const kv = lines[i].match(/^(name|description):\s*(.*)$/);
      if (!kv) continue;
      let v = kv[2].trim();
      if (/^[>|][+-]?$/.test(v)) { v = ""; while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) v += " " + lines[++i].trim(); }
      out[kv[1]] = v.replace(/^["']|["']$/g, "").trim();
    }
    return out;
  }

  /* ---------- 复制 / 提示 ---------- */
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const t = el("textarea", { style: "position:fixed;opacity:0" }); t.value = text; document.body.append(t); t.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch {} t.remove(); return ok;
    }
  }
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("is-on"), 1800);
  }

  /* ---------- 渲染 ---------- */
  function renderTabs() {
    const nav = $("#typeTabs"); nav.replaceChildren(...TYPES.map(t =>
      el("button", { class: "tab", type: "button", "aria-current": String(t.id === ui.type), text: t.name,
        onclick: () => { ui.type = t.id; ui.cat = ALL; render(); } })));
    $("#addBtn").textContent = `添加 ${TYPES.find(t => t.id === ui.type).noun}`;
  }

  function renderCats() {
    const list = items();
    const row = (id, name, n) => el("li", {}, el("button", { class: "cat", type: "button", "aria-current": String(ui.cat === id),
      onclick: () => { ui.cat = id; render(); } }, el("span", { text: name }), el("span", { class: "cat__n", text: String(n) })));
    const pinned = list.filter(s => user.pinned.includes(s.id)).length;
    $("#cats").replaceChildren(
      row(ALL, "全部", list.length),
      row(PIN, "常用", pinned),
      ...categories().map(c => row(c.id, c.name, list.filter(s => s.category === c.id).length)),
    );
  }

  function visible() {
    const q = ui.q.trim().toLowerCase();
    return items()
      .filter(s => ui.cat === ALL ? true : ui.cat === PIN ? user.pinned.includes(s.id) : s.category === ui.cat)
      .filter(s => !q || [s.name, s.desc, s.repo, catName(s.category)].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (user.pinned.includes(b.id) - user.pinned.includes(a.id)));
  }

  function card(s, i) {
    const pinned = user.pinned.includes(s.id);
    const copyBtn = el("button", { class: "btn btn--primary btn--sm", type: "button", text: "复制链接" });
    copyBtn.addEventListener("click", async () => {
      if (await copy(s.url)) {
        copyBtn.textContent = "已复制"; copyBtn.classList.add("is-done"); toast(`已复制 ${s.name} 的原始链接`);
        setTimeout(() => { copyBtn.textContent = "复制链接"; copyBtn.classList.remove("is-done"); }, 1400);
      } else toast("复制失败,请手动复制");
    });
    return el("article", { class: "card", style: `--i:${Math.min(i, 16)}` },
      el("div", { class: "card__top" },
        el("h2", { class: "card__name", text: s.name }),
        el("div", { class: "card__tools" },
          el("button", { class: "pin", type: "button", "aria-pressed": String(pinned), text: pinned ? "已置顶" : "置顶",
            onclick: () => { toggle(user.pinned, s.id); save(); render(); } }),
          el("button", { class: "pin", type: "button", text: "编辑", onclick: () => openDialog(s) }),
          el("button", { class: "pin", type: "button", text: "移除", onclick: () => remove(s) }))),
      el("p", { class: "card__desc", text: s.desc || "暂无简介" }),
      el("div", { class: "card__meta" }, el("span", { class: "tag", text: catName(s.category) }),
        s.repo ? el("span", { class: "card__repo", text: s.repo }) : null),
      el("div", { class: "card__actions" }, copyBtn,
        el("a", { class: "btn btn--sm", href: s.url, target: "_blank", rel: "noopener noreferrer", text: "打开" })));
  }

  function render() {
    renderTabs(); renderCats();
    const list = visible();
    const name = ui.cat === ALL ? "全部" : ui.cat === PIN ? "常用" : catName(ui.cat);
    $("#title").textContent = name;
    $("#count").textContent = `${list.length} 项`;
    $("#grid").replaceChildren(...list.map(card));
    $("#empty").hidden = list.length > 0;
  }

  const toggle = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); };

  function remove(s) {
    if (!confirm(`确定移除 “${s.name}” 吗?`)) return;
    if (user.added.some(a => a.id === s.id)) user.added = user.added.filter(a => a.id !== s.id);
    else user.hidden.push(s.id);
    user.pinned = user.pinned.filter(id => id !== s.id);
    save(); render(); toast("已移除");
  }

  /* ---------- 添加 / 编辑 ---------- */
  const dlg = $("#dlg"), f = { url: $("#fUrl"), name: $("#fName"), cat: $("#fCat"), newCat: $("#fNewCat"), desc: $("#fDesc") };
  const NEW = "__new__";

  function fillCats(selected) {
    f.cat.replaceChildren(...categories().map(c => el("option", { value: c.id, text: c.name, selected: c.id === selected })),
      el("option", { value: NEW, text: "+ 新建分类..." }));
    $("#newCatField").hidden = true;
  }
  function showError(msg) { const e = $("#formError"); e.hidden = !msg; e.textContent = msg || ""; }

  function openDialog(s = null) {
    ui.editing = s; showError("");
    $("#dlgTitle").textContent = s ? "编辑" : "添加 Skill";
    f.url.value = s ? s.url : ""; f.name.value = s ? s.name : ""; f.desc.value = s ? s.desc || "" : ""; f.newCat.value = "";
    fillCats(s ? s.category : (ui.cat !== ALL && ui.cat !== PIN ? ui.cat : categories()[0]?.id));
    setHelp("支持 blob / tree / raw 链接,会自动转成原始 SKILL.md 链接。");
    dlg.showModal(); (s ? f.name : f.url).focus();
  }
  function setHelp(msg, ok) { const h = $("#urlHelp"); h.textContent = msg; h.classList.toggle("is-ok", !!ok); }

  let probeSeq = 0;
  async function probeUrl() {
    const raw = toRaw(f.url.value); if (!f.url.value.trim()) return;
    if (!raw) return setHelp("链接格式不对,请粘贴 github.com 的文件或文件夹链接。");
    f.url.value = raw;
    if (!f.name.value) f.name.value = nameFromUrl(raw);
    setHelp("已转换为原始链接,正在读取简介...", true);
    const seq = ++probeSeq;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
      const r = await fetch(raw, { signal: ctl.signal }); clearTimeout(t);
      if (!r.ok) throw new Error(r.status);
      const fm = parseFrontmatter(await r.text());
      if (seq !== probeSeq) return;
      if (fm.name && !ui.editing) f.name.value = fm.name;
      if (fm.description && !f.desc.value) f.desc.value = fm.description.slice(0, 200);
      setHelp(fm.description ? "已自动填入名称和简介。" : "已转换为原始链接,请手动补充简介。", true);
    } catch { if (seq === probeSeq) setHelp("已转换为原始链接。暂时读不到文件内容(可能网络受限),请手动填写简介。", true); }
  }

  f.url.addEventListener("change", probeUrl);
  f.url.addEventListener("paste", () => setTimeout(probeUrl, 0));
  f.cat.addEventListener("change", () => { $("#newCatField").hidden = f.cat.value !== NEW; if (f.cat.value === NEW) f.newCat.focus(); });
  $("#cancelBtn").addEventListener("click", () => dlg.close());

  const slug = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "x";
  const uid = () => "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  $("#form").addEventListener("submit", e => {
    e.preventDefault();
    const url = toRaw(f.url.value);
    if (!url) return showError("请填写有效的 GitHub 链接。");
    const name = f.name.value.trim(); if (!name) return showError("请填写名称。");
    let category = f.cat.value;
    if (category === NEW) {
      const cn = f.newCat.value.trim(); if (!cn) return showError("请填写新分类名称。");
      const exist = categories().find(c => c.name === cn);
      category = exist ? exist.id : (() => { const c = { id: "c-" + slug(cn), name: cn }; user.categories.push(c); return c.id; })();
    }
    const data = { name, category, desc: f.desc.value.trim(), url, repo: repoOf(url) };
    const s = ui.editing;
    if (!s) user.added.unshift({ id: uid(), type: ui.type, ...data });
    else if (user.added.some(a => a.id === s.id)) user.added = user.added.map(a => a.id === s.id ? { ...a, ...data } : a);
    else user.overrides[s.id] = data;
    save(); dlg.close(); render(); toast(s ? "已保存" : "已添加");
  });

  $("#addCatBtn").addEventListener("click", () => {
    const n = prompt("新分类名称"); if (!n || !n.trim()) return;
    const name = n.trim();
    if (!categories().some(c => c.name === name)) user.categories.push({ id: "c-" + slug(name), name });
    save(); render();
  });

  /* ---------- 菜单 / 数据 / 主题 ---------- */
  const menu = $("#moreMenu"), moreBtn = $("#moreBtn");
  const setMenu = open => { menu.hidden = !open; moreBtn.setAttribute("aria-expanded", String(open)); };
  moreBtn.addEventListener("click", e => { e.stopPropagation(); setMenu(menu.hidden); });
  document.addEventListener("click", e => { if (!menu.contains(e.target)) setMenu(false); });

  $("#exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(user, null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "skill-market-backup.json" }); a.click(); URL.revokeObjectURL(a.href);
    setMenu(false); toast("已导出");
  });
  $("#importBtn").addEventListener("click", () => { $("#importFile").click(); setMenu(false); });
  $("#importFile").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (typeof d !== "object" || !Array.isArray(d.added || [])) throw 0;
      const s = v => (typeof v === "string" ? v : "");
      user = {
        added: (d.added || []).filter(a => a && s(a.url) && s(a.name)).map(a => ({ id: s(a.id) || uid(), type: s(a.type) || "skill", name: s(a.name), desc: s(a.desc), category: s(a.category), url: s(a.url), repo: s(a.repo) })),
        overrides: d.overrides && typeof d.overrides === "object" ? d.overrides : {},
        hidden: (d.hidden || []).map(String), pinned: (d.pinned || []).map(String),
        categories: (d.categories || []).filter(c => c && s(c.id) && s(c.name)).map(c => ({ id: s(c.id), name: s(c.name) })),
      };
      save(); render(); toast("导入成功");
    } catch { toast("导入失败:文件格式不对"); }
    e.target.value = "";
  });
  $("#resetBtn").addEventListener("click", () => {
    setMenu(false);
    if (confirm("这会清空你添加、编辑、置顶的所有内容,恢复默认。确定吗?")) { localStorage.removeItem(STORE); user = load(); render(); toast("已恢复默认"); }
  });

  $("#themeBtn").addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next; localStorage.setItem("sm.theme", next);
  });

  $("#q").addEventListener("input", e => { ui.q = e.target.value; render(); });
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $("#q").focus(); }
    if (e.key === "Escape") setMenu(false);
  });
  $("#addBtn").addEventListener("click", () => openDialog());

  /* ---------- 启动 ---------- */
  $("#grid").replaceChildren(...Array.from({ length: 6 }, () => el("div", { class: "skeleton" })));
  fetch("data/skills.json").then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(d => { base = d; render(); })
    .catch(() => { $("#grid").replaceChildren(); $("#empty").hidden = false;
      $("#empty").querySelector(".empty__title").textContent = "预置数据加载失败";
      $("#empty").querySelector(".muted").textContent = "请通过 http 服务访问本页(不要直接双击打开 html 文件)。运行: npx serve ."; });
})();
