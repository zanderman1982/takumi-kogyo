// note の公開記事(RSS)を読み、最新の数件だけを返す。ページの「note の最新記事」用。
const FEED = "https://note.com/open_zander/rss";
const LIMIT = 6;
const CACHE_KEY = "notes:latest";
const CACHE_SECONDS = 1800; // 30分ごとに取り直す

const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };
const decode = (s) => String(s).replace(/&(amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] || m);
const text = (block, tag) => {
  const m = block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">"));
  if (!m) return "";
  const raw = m[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return decode(cdata ? cdata[1] : raw).trim();
};

// ページに出すのは note.com の記事と、note の画像サーバーの画像だけ(それ以外のアドレスは捨てる)
export const isNoteUrl = (u) => /^https:\/\/note\.com\/[A-Za-z0-9_\/.\-]+$/.test(u);
export const isImageUrl = (u) => /^https:\/\/assets\.st-note\.com\/[^\s"'<>]+$/.test(u);

export function parseRss(xml, limit = LIMIT) {
  const items = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const title = text(b, "title").slice(0, 120);
    const link = text(b, "link");
    const date = new Date(text(b, "pubDate"));
    if (!title || !isNoteUrl(link) || Number.isNaN(date.getTime())) continue;
    const thumb = text(b, "media:thumbnail");
    items.push({ title, link, date: date.toISOString().slice(0, 10), image: isImageUrl(thumb) ? thumb : "" });
    if (items.length >= limit) break;
  }
  return items;
}

export async function getNotes(env, fetchFn = fetch, now = Date.now()) {
  const cached = await env.KV.get(CACHE_KEY);
  if (cached) {
    const c = JSON.parse(cached);
    if (now - c.at < CACHE_SECONDS * 1000) return c.items;
  }
  try {
    const r = await fetchFn(FEED, { headers: { "user-agent": "Mozilla/5.0 (compatible; takumi-kogyo-site)" } });
    if (!r.ok) throw new Error("feed " + r.status);
    const items = parseRss(await r.text());
    if (items.length) {
      await env.KV.put(CACHE_KEY, JSON.stringify({ at: now, items }), { expirationTtl: 86400 });
      return items;
    }
  } catch (e) {
    // 取れなかったときは、古い保存分があればそれを返す
    if (cached) return JSON.parse(cached).items;
  }
  return [];
}
