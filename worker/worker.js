// 复制次数统计服务(Cloudflare Worker + KV)。部署方法见 worker/README.md
// GET  /counts       -> { "<链接>": 次数, ... }
// POST /hit  {url}   -> 次数 +1(同一 IP 对同一链接 6 小时内只记一次)
const ORIGINS = ["https://liuzq802.github.io", "http://localhost:4173"];
const URL_OK = /^https:\/\/[^\s]{8,400}$/;

const cors = origin => ({
  "access-control-allow-origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  vary: "origin",
});
const json = (data, origin, extra = {}) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json", ...cors(origin), ...extra } });

export default {
  async fetch(req, env) {
    const origin = req.headers.get("origin") || "";
    const { pathname } = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(origin) });

    if (req.method === "GET" && pathname === "/counts")
      return json(JSON.parse((await env.KV.get("counts")) || "{}"), origin, { "cache-control": "public, max-age=60" });

    if (req.method === "POST" && pathname === "/hit") {
      let url;
      try { url = (await req.json()).url; } catch { return json({ error: "bad json" }, origin); }
      if (typeof url !== "string" || !URL_OK.test(url)) return json({ error: "bad url" }, origin);

      const ip = req.headers.get("cf-connecting-ip") || "0";
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "|" + url));
      const rkey = "r:" + [...new Uint8Array(digest)].slice(0, 12).map(b => b.toString(16).padStart(2, "0")).join("");
      if (await env.KV.get(rkey)) return json({ counted: false }, origin);

      const counts = JSON.parse((await env.KV.get("counts")) || "{}");
      counts[url] = (counts[url] || 0) + 1;
      await Promise.all([env.KV.put("counts", JSON.stringify(counts)), env.KV.put(rkey, "1", { expirationTtl: 21600 })]);
      return json({ counted: true, count: counts[url] }, origin);
    }
    return new Response("not found", { status: 404 });
  },
};
