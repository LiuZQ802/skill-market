/* 常用工具超市: 纯静态前端。
   预置数据来自 data/items.json,用户的增删改、置顶、新建类型保存在 localStorage。
   "类型"(Skills、提示词、MCP 等)可在页面顶部直接新建,每个类型有自己的分类。 */
(() => {
  "use strict";

  const STORE = "sm.user.v1";
  const PIN = "pinned", ALL = "all", RANK = "rank";
  const CFG = window.SM_CONFIG || {};

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
  let base = { types: [], categories: [], skills: [] };
  let globalCounts = null; // 统计服务返回的全站次数,未配置时为 null
  let user = load();
  let ui = { type: "skill", cat: ALL, q: "", editing: null, open: new Set() };

  function load() {
    const empty = { added: [], overrides: {}, hidden: [], pinned: [], categories: [], types: [], counts: {} };
    try { return { ...empty, ...JSON.parse(localStorage.getItem(STORE) || "{}") }; }
    catch { return empty; }
  }
  const save = () => localStorage.setItem(STORE, JSON.stringify(user));

  const types = () => [...base.types, ...user.types.filter(t => !base.types.some(b => b.id === t.id))];
  const curType = () => types().find(t => t.id === ui.type) || types()[0] || { id: "skill", name: "Skills", noun: "Skill" };
  const categories = () => [...base.categories, ...user.categories.filter(c => !base.categories.some(b => b.id === c.id))]
    .filter(c => (c.type || "skill") === ui.type);
  const catName = id => ([...base.categories, ...user.categories].find(c => c.id === id) || { name: "未分类" }).name;
  const items = () => {
    const hid = new Set(user.hidden);
    return [
      ...base.skills.filter(s => !hid.has(s.id)).map(s => ({ ...s, ...(user.overrides[s.id] || {}) })),
      ...user.added,
    ].filter(s => (s.type || "skill") === ui.type && !(s.group && hid.has(s.group)));
  };
  // "系列"(kind=group)把同一仓库的多个条目合并成一张可展开的卡片,成员通过 group 字段指向系列 id
  const leaves = () => items().filter(s => s.kind !== "group");
  const groups = () => items().filter(s => s.kind === "group");
  const membersOf = g => items().filter(s => s.group === g.id);
  const topLevel = () => { const ids = new Set(groups().map(g => g.id)); return items().filter(s => !s.group || !ids.has(s.group)); };
  const matches = (s, q) => !q || [s.name, s.desc, s.repo, catName(s.category)].join(" ").toLowerCase().includes(q);

  /* ---------- 链接处理 ---------- */
  // 把 GitHub 的 blob / tree / 仓库链接统一成 raw 地址
  function toRaw(input) {
    let u;
    try { u = new URL(input.trim()); } catch { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    if (u.hostname === "raw.githubusercontent.com") return parts.length >= 4 ? u.href : null;
    if (u.hostname !== "github.com") return u.href; // 非 GitHub 的普通网站,原样保留
    if (parts.length < 2) return null;
    const [owner, repo, kind, branch, ...rest] = parts;
    if (kind === "blob" && branch && rest.length) return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`;
    if (kind === "tree" && branch) return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${[...rest, "SKILL.md"].join("/")}`;
    if (!kind) return `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`;
    return u.href; // issues、releases 等其他 GitHub 页面原样保留
  }
  // 点击跳转的页面: raw 链接 -> GitHub 仓库(单 skill 仓库)或仓库内对应的 skill 目录(多 skill 仓库)
  function pageOf(url) {
    let u; try { u = new URL(url); } catch { return url; }
    if (u.hostname !== "raw.githubusercontent.com") return url;
    const [owner, repo, branch, ...rest] = u.pathname.split("/").filter(Boolean);
    const file = rest.pop() || "";
    if (/^skill\.md$/i.test(file)) return rest.length ? `https://github.com/${owner}/${repo}/tree/${branch}/${rest.join("/")}` : `https://github.com/${owner}/${repo}`;
    return `https://github.com/${owner}/${repo}/blob/${branch}/${[...rest, file].join("/")}`;
  }
  const repoOf = url => { const u = new URL(url); const p = u.pathname.split("/").filter(Boolean); return /github/.test(u.hostname) && p.length >= 2 ? `${p[0]}/${p[1]}` : u.hostname; };
  const nameFromUrl = url => { const u = new URL(url); if (u.hostname !== "raw.githubusercontent.com" && u.hostname !== "github.com") return u.hostname.replace(/^www\./, ""); const p = u.pathname.split("/").filter(Boolean); const last = p[p.length - 1]; return /\.md$/i.test(last) && p.length > 4 ? (/^skill\.md$/i.test(last) ? p[p.length - 2] : last.replace(/\.md$/i, "")) : last; };

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

  /* ---------- 复制次数 ---------- */
  const countOf = s => globalCounts ? (globalCounts[s.url] || 0) : (user.counts[s.url] || 0);
  function hit(s) {
    user.counts[s.url] = (user.counts[s.url] || 0) + 1; save();
    if (!CFG.counterApi) return;
    if (globalCounts) globalCounts[s.url] = (globalCounts[s.url] || 0) + 1;
    fetch(CFG.counterApi.replace(/\/$/, "") + "/hit", { method: "POST", keepalive: true,
      headers: { "content-type": "text/plain" }, body: JSON.stringify({ url: s.url }) }).catch(() => {});
  }
  function loadCounts() {
    if (!CFG.counterApi) return;
    fetch(CFG.counterApi.replace(/\/$/, "") + "/counts").then(r => r.json()).then(d => { globalCounts = d; render(); }).catch(() => {});
  }

  /* ---------- 渲染 ---------- */
  function renderTabs() {
    const nav = $("#typeTabs"); nav.replaceChildren(...types().map(t =>
      el("button", { class: "tab", type: "button", "aria-current": String(t.id === ui.type), text: t.name,
        onclick: () => { ui.type = t.id; ui.cat = ALL; render(); } })),
      el("button", { class: "tab tab--add", type: "button", text: "+ 新类型", title: "新建一类工具,例如提示词、MCP、网站",
        onclick: addType }));
    $("#addBtn").textContent = `添加 ${curType().noun}`;
  }

  function addType() {
    const n = (prompt("新类型名称(例如:提示词、MCP、网站、插件)") || "").trim(); if (!n) return;
    if (types().some(t => t.name === n)) return toast("这个类型已经有了");
    const t = { id: "t-" + slug(n), name: n, noun: n };
    user.types.push(t); save(); ui.type = t.id; ui.cat = ALL; render(); toast(`已新建类型 ${n}`);
  }

  function renderCats() {
    const list = topLevel();
    const row = (id, name, n) => el("li", {}, el("button", { class: "cat", type: "button", "aria-current": String(ui.cat === id),
      onclick: () => { ui.cat = id; render(); } }, el("span", { text: name }), el("span", { class: "cat__n", text: String(n) })));
    const pinned = items().filter(s => user.pinned.includes(s.id)).length;
    $("#cats").replaceChildren(
      row(ALL, "全部", list.length),
      row(PIN, "常用", pinned),
      row(RANK, "排行榜", leaves().length),
      ...categories().map(c => row(c.id, c.name, list.filter(s => s.category === c.id).length)),
    );
  }

  function visible() {
    const q = ui.q.trim().toLowerCase();
    const list = ui.cat === PIN
      ? items().filter(s => user.pinned.includes(s.id) && matches(s, q))
      : topLevel().filter(s => ui.cat === ALL || s.category === ui.cat)
          .filter(s => matches(s, q) || (s.kind === "group" && membersOf(s).some(m => matches(m, q))));
    return list.sort((a, b) => (user.pinned.includes(b.id) - user.pinned.includes(a.id)));
  }

  function card(s, i, compact = false) {
    if (s.kind === "group") return groupCard(s, i);
    const pinned = user.pinned.includes(s.id);
    const copyBtn = el("button", { class: "btn btn--primary btn--sm", type: "button", text: "复制链接", title: "复制原始文件链接" });
    copyBtn.addEventListener("click", async () => {
      if (await copy(s.url)) {
        hit(s);
        copyBtn.textContent = "已复制"; copyBtn.classList.add("is-done"); toast(`已复制 ${s.name} 的原始链接`);
        setTimeout(() => { copyBtn.textContent = "复制链接"; copyBtn.classList.remove("is-done"); }, 1400);
      } else toast("复制失败,请手动复制");
    });
    return el("article", { class: "card", style: `--i:${Math.min(i, 16)}` },
      el("div", { class: "card__top" },
        el("h2", { class: "card__name" }, el("a", { href: pageOf(s.url), target: "_blank", rel: "noopener noreferrer", text: s.name, title: "在 GitHub 上查看" })),
        el("div", { class: "card__tools" },
          el("button", { class: "pin", type: "button", "aria-pressed": String(pinned), text: pinned ? "已置顶" : "置顶",
            onclick: () => { toggle(user.pinned, s.id); save(); render(); } }),
          el("button", { class: "pin", type: "button", text: "编辑", onclick: () => openDialog(s) }),
          el("button", { class: "pin", type: "button", text: "移除", onclick: () => remove(s) }))),
      el("p", { class: "card__desc", text: s.desc || "暂无简介" }),
      compact ? null : el("div", { class: "card__meta" }, el("span", { class: "tag", text: catName(s.category) }),
        s.repo ? el("span", { class: "card__repo", text: s.repo }) : null),
      el("div", { class: "card__actions" }, copyBtn,
        el("a", { class: "btn btn--sm", href: pageOf(s.url), target: "_blank", rel: "noopener noreferrer", text: "查看仓库" })));
  }

  function groupCard(g, i) {
    const q = ui.q.trim().toLowerCase();
    const all = membersOf(g);
    const shown = q && !matches(g, q) ? all.filter(m => matches(m, q)) : all;
    const open = ui.open.has(g.id) || (!!q && shown.length < all.length);
    const pinned = user.pinned.includes(g.id);
    const noun = curType().noun;
    const toggleBtn = el("button", { class: "btn btn--primary btn--sm", type: "button", "aria-expanded": String(open),
      text: open ? "收起" : `展开 ${all.length} 个`,
      onclick: () => { ui.open.has(g.id) ? ui.open.delete(g.id) : ui.open.add(g.id); render(); } });
    const copyAll = el("button", { class: "btn btn--sm", type: "button", text: "复制全部链接", title: "每行一个原始链接",
      onclick: async () => { toast(await copy(all.map(m => m.url).join("\n")) ? `已复制 ${all.length} 条链接` : "复制失败,请手动复制"); } });
    return el("article", { class: "card card--group" + (open ? " is-open" : ""), style: `--i:${Math.min(i, 16)}` },
      el("div", { class: "card__top" },
        g.url ? el("h2", { class: "card__name" }, el("a", { href: g.url, target: "_blank", rel: "noopener noreferrer", text: g.name, title: "在 GitHub 上查看" }))
              : el("h2", { class: "card__name", text: g.name }),
        el("div", { class: "card__tools" },
          el("button", { class: "pin", type: "button", "aria-pressed": String(pinned), text: pinned ? "已置顶" : "置顶",
            onclick: () => { toggle(user.pinned, g.id); save(); render(); } }),
          el("button", { class: "pin", type: "button", text: "编辑", onclick: () => openDialog(g) }),
          el("button", { class: "pin", type: "button", text: "移除", onclick: () => remove(g) }))),
      el("p", { class: "card__desc", text: g.desc || "暂无简介" }),
      el("div", { class: "card__meta" }, el("span", { class: "tag", text: catName(g.category) }),
        el("span", { text: `系列,共 ${all.length} 个 ${noun}` }), g.repo ? el("span", { class: "card__repo", text: g.repo }) : null),
      el("div", { class: "card__actions" }, toggleBtn, copyAll,
        g.url ? el("a", { class: "btn btn--sm", href: g.url, target: "_blank", rel: "noopener noreferrer", text: "查看仓库" }) : null),
      open ? el("div", { class: "group__list" }, ...shown.map(m => card(m, 0, true))) : null);
  }

  const fmtStars = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : String(n);
  function rankRow(s, i) {
    const copyBtn = el("button", { class: "btn btn--sm", type: "button", text: "复制链接" });
    copyBtn.addEventListener("click", async () => { if (await copy(s.url)) { hit(s); toast(`已复制 ${s.name} 的原始链接`); setTimeout(render, 600); } });
    return el("li", { class: "rank__row" },
      el("span", { class: "rank__n" + (i < 3 ? " is-top" : ""), text: String(i + 1) }),
      el("div", { class: "rank__main" },
        el("a", { class: "rank__name", href: pageOf(s.url), target: "_blank", rel: "noopener noreferrer", text: s.name }),
        el("p", { class: "muted", text: s.desc || "暂无简介" })),
      el("div", { class: "rank__stat" }, el("strong", { text: String(countOf(s)) }), el("span", { class: "muted", text: "次复制" })),
      s.stars != null ? el("div", { class: "rank__stat" }, el("strong", { text: fmtStars(s.stars) }), el("span", { class: "muted", text: "仓库 Star" })) : el("div"),
      copyBtn);
  }

  function renderRank() {
    const q = ui.q.trim().toLowerCase();
    const list = leaves().filter(s => !q || [s.name, s.desc, s.repo].join(" ").toLowerCase().includes(q))
      .sort((a, b) => countOf(b) - countOf(a) || (b.stars || 0) - (a.stars || 0));
    $("#title").textContent = "排行榜";
    $("#count").textContent = CFG.counterApi
      ? (globalCounts ? "按所有人的复制次数排序" : "正在加载全站数据...")
      : "目前只统计你本机的复制次数;次数相同时按仓库 Star 排序";
    $("#grid").replaceChildren(el("ol", { class: "rank" }, ...list.map(rankRow)));
    $("#grid").classList.add("is-rank");
    $("#empty").hidden = list.length > 0;
  }

  function render() {
    renderTabs(); renderCats();
    $("#grid").classList.remove("is-rank");
    if (ui.cat === RANK) return renderRank();
    const list = visible();
    const name = ui.cat === ALL ? "全部" : ui.cat === PIN ? "常用" : catName(ui.cat);
    $("#title").textContent = name;
    $("#count").textContent = `${list.length} 项`;
    $("#grid").replaceChildren(...list.map(card));
    $("#empty").hidden = list.length > 0;
  }

  const toggle = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); };

  function remove(s) {
    const n = s.kind === "group" ? membersOf(s).length : 0;
    if (!confirm(n ? `确定移除系列 “${s.name}” 及其中的 ${n} 个条目吗?` : `确定移除 “${s.name}” 吗?`)) return;
    const gone = new Set([s.id, ...(n ? membersOf(s).map(m => m.id) : [])]);
    user.added = user.added.filter(a => !gone.has(a.id));
    user.hidden.push(...[...gone].filter(id => !user.added.some(a => a.id === id) && base.skills.some(b => b.id === id)));
    user.pinned = user.pinned.filter(id => !gone.has(id));
    save(); render(); toast("已移除");
  }

  /* ---------- 添加 / 编辑 ---------- */
  const dlg = $("#dlg"), f = { url: $("#fUrl"), name: $("#fName"), cat: $("#fCat"), newCat: $("#fNewCat"), desc: $("#fDesc"), group: $("#fGroup"), newGroup: $("#fNewGroup") };
  const NEWG = "__newg__";
  const isGroupEdit = () => ui.editing?.kind === "group";
  const NEW = "__new__";

  function fillCats(selected) {
    f.cat.replaceChildren(...categories().map(c => el("option", { value: c.id, text: c.name, selected: c.id === selected })),
      el("option", { value: NEW, text: "+ 新建分类..." }));
    $("#newCatField").hidden = f.cat.value !== NEW;
  }
  function fillGroups(selected) {
    f.group.replaceChildren(el("option", { value: "", text: "不属于任何系列" }),
      ...groups().map(g => el("option", { value: g.id, text: g.name, selected: g.id === selected })),
      el("option", { value: NEWG, text: "+ 新建系列..." }));
    $("#newGroupField").hidden = f.group.value !== NEWG;
  }
  function showError(msg) { const e = $("#formError"); e.hidden = !msg; e.textContent = msg || ""; }

  function openDialog(s = null) {
    ui.editing = s; showError("");
    $("#dlgTitle").textContent = s ? (s.kind === "group" ? "编辑系列" : "编辑") : `添加 ${curType().noun}`;
    const g = s?.kind === "group";
    f.url.closest(".field").hidden = g; f.group.closest(".field").hidden = g; f.newGroup.value = "";
    f.url.value = s ? s.url : ""; f.name.value = s ? s.name : ""; f.desc.value = s ? s.desc || "" : ""; f.newCat.value = "";
    fillCats(s ? s.category : ([ALL, PIN, RANK].includes(ui.cat) ? categories()[0]?.id : ui.cat));
    fillGroups(s ? s.group : "");
    if (g) $("#newGroupField").hidden = true;
    setHelp("GitHub 的 blob / tree / raw 链接会自动转成原始链接;其他网站的链接原样保存。");
    dlg.showModal(); (s ? f.name : f.url).focus();
  }
  function setHelp(msg, ok) { const h = $("#urlHelp"); h.textContent = msg; h.classList.toggle("is-ok", !!ok); }

  let probeSeq = 0;
  async function probeUrl() {
    const raw = toRaw(f.url.value); if (!f.url.value.trim()) return;
    if (!raw) return setHelp("链接格式不对,请粘贴以 https:// 开头的链接。");
    f.url.value = raw;
    if (!f.name.value) f.name.value = nameFromUrl(raw);
    if (!/raw\.githubusercontent\.com/.test(raw)) return setHelp("已保存链接,请手动填写简介。", true);
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
  f.group.addEventListener("change", () => { $("#newGroupField").hidden = f.group.value !== NEWG; if (f.group.value === NEWG) f.newGroup.focus(); });
  f.cat.addEventListener("change", () => { $("#newCatField").hidden = f.cat.value !== NEW; if (f.cat.value === NEW) f.newCat.focus(); });
  $("#cancelBtn").addEventListener("click", () => dlg.close());

  const slug = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "x";
  const uid = () => "u-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  $("#form").addEventListener("submit", e => {
    e.preventDefault();
    const grp = isGroupEdit();
    const url = grp ? "" : toRaw(f.url.value);
    if (!grp && !url) return showError("请填写有效的链接(以 https:// 开头)。");
    const name = f.name.value.trim(); if (!name) return showError("请填写名称。");
    let category = f.cat.value;
    if (category === NEW) {
      const cn = f.newCat.value.trim(); if (!cn) return showError("请填写新分类名称。");
      const exist = categories().find(c => c.name === cn);
      category = exist ? exist.id : (() => { const c = { id: "c-" + slug(cn), name: cn, type: ui.type }; user.categories.push(c); return c.id; })();
    }
    let data = { name, category, desc: f.desc.value.trim() };
    if (!grp) {
      let group = f.group.value;
      if (group === NEWG) {
        const gn = f.newGroup.value.trim(); if (!gn) return showError("请填写新系列名称。");
        const ex = groups().find(g => g.name === gn);
        if (ex) group = ex.id;
        else { group = uid(); user.added.unshift({ id: group, type: ui.type, kind: "group", name: gn, desc: "", category, url: "", repo: "" }); }
      }
      data = { ...data, url, repo: repoOf(url), group };
    }
    const s = ui.editing;
    if (!s) user.added.unshift({ id: uid(), type: ui.type, ...data });
    else if (user.added.some(a => a.id === s.id)) user.added = user.added.map(a => a.id === s.id ? { ...a, ...data } : a);
    else user.overrides[s.id] = data;
    save(); dlg.close(); render(); toast(s ? "已保存" : "已添加");
  });

  $("#addCatBtn").addEventListener("click", () => {
    const n = prompt("新分类名称"); if (!n || !n.trim()) return;
    const name = n.trim();
    if (!categories().some(c => c.name === name)) user.categories.push({ id: "c-" + slug(name), name, type: ui.type });
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
        added: (d.added || []).filter(a => a && s(a.name) && (s(a.url) || a.kind === "group")).map(a => ({ id: s(a.id) || uid(), type: s(a.type) || "skill", name: s(a.name), desc: s(a.desc), category: s(a.category), url: s(a.url), repo: s(a.repo), kind: s(a.kind), group: s(a.group) })),
        overrides: d.overrides && typeof d.overrides === "object" ? d.overrides : {},
        hidden: (d.hidden || []).map(String), pinned: (d.pinned || []).map(String),
        categories: (d.categories || []).filter(c => c && s(c.id) && s(c.name)).map(c => ({ id: s(c.id), name: s(c.name), type: s(c.type) || "skill" })),
        types: (d.types || []).filter(t => t && s(t.id) && s(t.name)).map(t => ({ id: s(t.id), name: s(t.name), noun: s(t.noun) || s(t.name) })),
        counts: d.counts && typeof d.counts === "object" ? d.counts : {},
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
  fetch("data/items.json").then(r => { if (!r.ok) throw 0; return r.json(); })
    .then(d => { base = d; ui.type = types()[0]?.id || "skill"; if (location.hash === "#rank") ui.cat = RANK; const hq = location.hash.match(/^#q=(.*)$/); if (hq) { ui.q = decodeURIComponent(hq[1]); $("#q").value = ui.q; } render(); loadCounts(); })
    .catch(() => { $("#grid").replaceChildren(); $("#empty").hidden = false;
      $("#empty").querySelector(".empty__title").textContent = "预置数据加载失败";
      $("#empty").querySelector(".muted").textContent = "请通过 http 服务访问本页(不要直接双击打开 html 文件)。运行: npx serve ."; });
})();
