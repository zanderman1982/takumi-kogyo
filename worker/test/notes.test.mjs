import test from "node:test";
import assert from "node:assert/strict";
import { parseRss, getNotes, isNoteUrl } from "../src/notes.js";

const item = (title, link, date, thumb = "") => `<item><title>${title}</title>${thumb ? `<media:thumbnail>${thumb}</media:thumbnail>` : ""}<description><![CDATA[<p>本文</p>]]></description><pubDate>${date}</pubDate><link>${link}</link></item>`;
const XML = `<rss><channel>${[
  item("【第三章】メンバーシップを開く &amp; 続き", "https://note.com/open_zander/n/n1", "Tue, 27 Oct 2026 11:03:20 +0900", "https://assets.st-note.com/production/uploads/images/1/a.png?width=800"),
  item("<![CDATA[CDATAの題名]]>", "https://note.com/open_zander/n/n2", "Mon, 26 Oct 2026 10:00:00 +0900"),
  item("危ないリンク", "javascript:alert(1)", "Mon, 26 Oct 2026 09:00:00 +0900"),
  item("別サイトのリンク", "https://evil.example/x", "Mon, 26 Oct 2026 08:00:00 +0900"),
  item("日付が壊れている", "https://note.com/open_zander/n/n3", "not a date"),
  item("画像が別サイト", "https://note.com/open_zander/n/n4", "Sun, 25 Oct 2026 10:00:00 +0900", "https://evil.example/a.png"),
].join("")}</channel></rss>`;

function kv() {
  const m = new Map();
  return { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, _m: m };
}

test("parseRss: 題名・リンク・日付・画像を取り、危ないものは捨てる", () => {
  const r = parseRss(XML);
  assert.deepEqual(r.map((x) => x.link), ["https://note.com/open_zander/n/n1", "https://note.com/open_zander/n/n2", "https://note.com/open_zander/n/n4"]);
  assert.equal(r[0].title, "【第三章】メンバーシップを開く & 続き");
  assert.equal(r[0].date, "2026-10-27");
  assert.match(r[0].image, /^https:\/\/assets\.st-note\.com\//);
  assert.equal(r[1].title, "CDATAの題名");
  assert.equal(r[2].image, ""); // note 以外の画像は使わない
});

test("parseRss: 件数の上限", () => {
  const many = `<rss>${Array.from({ length: 20 }, (_, i) => item("t" + i, "https://note.com/open_zander/n/n" + i, "Tue, 27 Oct 2026 11:03:20 +0900")).join("")}</rss>`;
  assert.equal(parseRss(many).length, 6);
});

test("isNoteUrl: note.com の https だけ", () => {
  assert.equal(isNoteUrl("https://note.com/open_zander/n/abc"), true);
  assert.equal(isNoteUrl("http://note.com/open_zander/n/abc"), false);
  assert.equal(isNoteUrl("https://note.com.evil.example/x"), false);
});

test("getNotes: 取得して保存し、30分以内は取り直さない", async () => {
  const env = { KV: kv() };
  let calls = 0;
  const f = async () => { calls++; return new Response(XML, { status: 200 }); };
  const a = await getNotes(env, f, 1000);
  const b = await getNotes(env, f, 1000 + 60000);
  assert.equal(a.length, 3);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
  await getNotes(env, f, 1000 + 31 * 60000);
  assert.equal(calls, 2);
});

test("getNotes: 取得に失敗したら、古い保存分を返す。無ければ空", async () => {
  const env = { KV: kv() };
  assert.deepEqual(await getNotes(env, async () => new Response("x", { status: 500 }), 1), []);
  await getNotes(env, async () => new Response(XML, { status: 200 }), 1000);
  const old = await getNotes(env, async () => { throw new Error("down"); }, 1000 + 40 * 60000);
  assert.equal(old.length, 3);
});
