import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const root = new URL("../../", import.meta.url);
const html = readFileSync(new URL("index.html", root), "utf8");

test("title と description は長すぎず、地域と業種を含む", () => {
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  const desc = html.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(title.length <= 45, "title が長い: " + title.length);
  assert.ok(desc.length <= 130, "description が長い: " + desc.length);
  for (const w of ["世田谷", "溶接", "鍛冶", "機械据え付け"]) assert.ok(title.includes(w) || desc.includes(w), w);
});

test("共有用の画像・アイコン・canonical・サイトマップがある", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/takumikougyou1105\.co\.jp\/">/);
  assert.match(html, /og:image" content="https:\/\/takumikougyou1105\.co\.jp\/og\.png"/);
  for (const f of ["og.png", "favicon.svg", "robots.txt", "sitemap.xml", "CNAME"]) assert.ok(existsSync(new URL(f, root)), f + " が無い");
  const robots = readFileSync(new URL("robots.txt", root), "utf8");
  assert.match(robots, /Sitemap: https:\/\/takumikougyou1105\.co\.jp\/sitemap\.xml/);
  assert.doesNotMatch(robots, /Disallow:\s*\//);
});

test("構造化データ(JSON-LD)が正しいJSONで、住所と電話を持つ", () => {
  const m = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  const j = JSON.parse(m[1]);
  assert.equal(j["@type"], "LocalBusiness");
  assert.equal(j.address.addressLocality, "世田谷区");
  assert.equal(j.telephone, "+81-3-6805-6474");
  assert.equal(j.url, "https://takumikougyou1105.co.jp/");
});

test("h1 は1つで、会社概要に所在地と電話がある", () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  assert.match(html, /id="about"/);
  assert.match(html, /〒157-0077 東京都世田谷区鎌田2-23-5-105/);
});

test("サイトマップは正しいXMLで、トップのURLを含む", () => {
  const x = readFileSync(new URL("sitemap.xml", root), "utf8");
  assert.match(x, /<loc>https:\/\/takumikougyou1105\.co\.jp\/<\/loc>/);
});
