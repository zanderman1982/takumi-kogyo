import test from "node:test";
import assert from "node:assert/strict";
import { stripHonorific, safeEqual, readJson, oneLine, allow, cleanMessages, handleChat, handleInquiry, handleAdmin, corsHeaders } from "../src/index.js";

function kv() {
  const m = new Map();
  return {
    get: async (k) => (m.has(k) ? m.get(k) : null),
    put: async (k, v) => { m.set(k, v); },
    list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
    _m: m,
  };
}
const req = (body, headers = {}, method = "POST") => new Request("https://x/y", { method, headers: { "content-type": "application/json", ...headers }, body: method === "GET" ? undefined : JSON.stringify(body) });
const claudeText = (t) => async () => new Response(JSON.stringify({ content: [{ type: "text", text: t }] }), { status: 200 });

test("cleanMessages: 最後がuserでなければ拒否、長さと回数を切る", () => {
  assert.equal(cleanMessages([]), null);
  assert.equal(cleanMessages([{ role: "assistant", content: "x" }]), null);
  const long = cleanMessages([{ role: "user", content: "あ".repeat(5000) }]);
  assert.equal(long[0].content.length, 600);
  const many = cleanMessages(Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "a" + i })).concat([{ role: "user", content: "last" }]));
  assert.ok(many.length <= 12 && many[0].role === "user" && many.at(-1).content === "last");
});

test("allow: IPごとの上限と1日の上限", async () => {
  const env = { KV: kv(), LIMIT_PER_IP_HOUR: "2", LIMIT_PER_DAY: "3" };
  assert.equal(await allow(env, "1.1.1.1", 1000), "");
  assert.equal(await allow(env, "1.1.1.1", 1000), "");
  assert.equal(await allow(env, "1.1.1.1", 1000), "ip");
  assert.equal(await allow(env, "2.2.2.2", 1000), "");
  assert.equal(await allow(env, "3.3.3.3", 1000), "day");
});

test("chat: 通常の返答はそのまま返し、問い合わせは保存されない", async () => {
  const env = { KV: kv(), ANTHROPIC_API_KEY: "k" };
  const r = await handleChat(req({ messages: [{ role: "user", content: "事業内容は?" }] }), env, claudeText("溶接工事、雑鍛冶、機械据え付けです。"));
  assert.equal(r.status, 200);
  assert.match(r.body.reply, /溶接/);
  assert.equal([...env.KV._m.keys()].filter((k) => k.startsWith("inq:")).length, 0);
});

test("chat: submit_inquiry で保存と通知(Gmail/LINE)", async () => {
  const env = { KV: kv(), ANTHROPIC_API_KEY: "k", RESEND_API_KEY: "r", NOTIFY_EMAIL_TO: "a@b.c", LINE_CHANNEL_TOKEN: "t", LINE_USER_ID: "u" };
  const calls = [];
  const f = async (url, init) => {
    calls.push(url);
    if (String(url).includes("anthropic")) return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "submit_inquiry", input: { name: "山田", contact: "090-0000-0000", summary: "溶接の相談" } }] }), { status: 200 });
    return new Response("{}", { status: 200 });
  };
  const r = await handleChat(req({ messages: [{ role: "user", content: "山田です 090-0000-0000 溶接の相談" }] }), env, f);
  assert.equal(r.body.received, true);
  assert.match(r.body.reply, /山田様、受け付けました/);
  assert.equal([...env.KV._m.keys()].filter((k) => k.startsWith("inq:")).length, 1);
  assert.ok(calls.some((u) => u.includes("resend")) && calls.some((u) => u.includes("line.me")));
});

test("chat: API失敗でも電話とメールを案内する", async () => {
  const env = { KV: kv(), ANTHROPIC_API_KEY: "k" };
  const r = await handleChat(req({ messages: [{ role: "user", content: "こんにちは" }] }), env, async () => new Response("no", { status: 500 }));
  assert.match(r.body.reply, /03-6805-6474/);
});

test("chat: 上限超えは429", async () => {
  const env = { KV: kv(), ANTHROPIC_API_KEY: "k", LIMIT_PER_IP_HOUR: "1" };
  const m = { messages: [{ role: "user", content: "a" }] };
  await handleChat(req(m, { "cf-connecting-ip": "9.9.9.9" }), env, claudeText("ok"));
  const r = await handleChat(req(m, { "cf-connecting-ip": "9.9.9.9" }), env, claudeText("ok"));
  assert.equal(r.status, 429);
});

test("フォーム: 必須項目、隠し欄(ボット)、保存", async () => {
  const env = { KV: kv() };
  assert.equal((await handleInquiry(req({ name: "a" }), env)).status, 400);
  const bot = await handleInquiry(req({ name: "a", contact: "b", message: "c", website: "spam" }), env);
  assert.equal(bot.status, 200);
  assert.equal([...env.KV._m.keys()].filter((k) => k.startsWith("inq:")).length, 0);
  const ok = await handleInquiry(req({ name: "山田", contact: "a@b.c", message: "見積をお願いします" }), env);
  assert.equal(ok.status, 200);
  assert.equal([...env.KV._m.keys()].filter((k) => k.startsWith("inq:")).length, 1);
});

test("admin: トークン無しは401、取得と確認済み", async () => {
  const env = { KV: kv(), NOTIFY_TOKEN: "secret" };
  await handleInquiry(req({ name: "山田", contact: "a@b.c", message: "相談" }), env);
  assert.equal((await handleAdmin(req(null, {}, "GET"), env)).status, 401);
  const auth = { authorization: "Bearer secret" };
  const list = await handleAdmin(req(null, auth, "GET"), env);
  assert.equal(list.body.items.length, 1);
  const id = list.body.items[0].id;
  assert.equal((await handleAdmin(req({ id }, auth), env)).status, 200);
  assert.equal((await handleAdmin(req(null, auth, "GET"), env)).body.items.length, 0);
});

test("CORS: 許可したサイトだけ", () => {
  const env = { ALLOWED_ORIGINS: "https://takumikougyou1105.co.jp" };
  const ok = corsHeaders(new Request("https://x", { headers: { origin: "https://takumikougyou1105.co.jp" } }), env);
  const ng = corsHeaders(new Request("https://x", { headers: { origin: "https://evil.example" } }), env);
  assert.equal(ok["access-control-allow-origin"], "https://takumikougyou1105.co.jp");
  assert.equal(ng["access-control-allow-origin"], undefined);
});

test("safeEqual: 同じ時だけ真", () => {
  assert.equal(safeEqual("Bearer a", "Bearer a"), true);
  assert.equal(safeEqual("Bearer a", "Bearer b"), false);
  assert.equal(safeEqual("Bearer a", "Bearer ab"), false);
});

test("readJson: 大きすぎる本文は断り、壊れたJSONはnull", async () => {
  assert.equal(await readJson(new Request("https://x", { method: "POST", body: "x".repeat(30000) })), null);
  assert.equal(await readJson(new Request("https://x", { method: "POST", body: "{bad" })), null);
  assert.deepEqual(await readJson(new Request("https://x", { method: "POST", body: '{"a":1}' })), { a: 1 });
});

test("oneLine: 改行と制御文字を外す(件名への改行混入を防ぐ)", () => {
  assert.equal(oneLine("山田\r\nBcc: evil@x.com"), "山田 Bcc: evil@x.com");
});

test("チャット: 大きすぎる送信は400", async () => {
  const env = { KV: kv(), ANTHROPIC_API_KEY: "k" };
  const r = await handleChat(new Request("https://x", { method: "POST", body: "x".repeat(30000) }), env, claudeText("ok"));
  assert.equal(r.status, 400);
});

test("stripHonorific: 末尾の敬称を外す(様様を防ぐ)", () => {
  assert.equal(stripHonorific("山田様"), "山田");
  assert.equal(stripHonorific("山田工務店 山田様"), "山田工務店 山田");
  assert.equal(stripHonorific("山田さん"), "山田");
  assert.equal(stripHonorific("山田工務店御中"), "山田工務店");
  assert.equal(stripHonorific("様山田"), "様山田");
  assert.equal(stripHonorific("山田"), "山田");
});

test("chat: 名前に様が付いていても、返事の「様」は1回", async () => {
  const env = { KV: kv(), ANTHROPIC_API_KEY: "k" };
  const f = async () => new Response(JSON.stringify({ content: [{ type: "tool_use", name: "submit_inquiry", input: { name: "山田工務店 山田様", contact: "090-0000-0000", summary: "相談" } }] }), { status: 200 });
  const r = await handleChat(req({ messages: [{ role: "user", content: "山田です" }] }), env, f);
  assert.match(r.body.reply, /山田様、受け付けました/);
  assert.doesNotMatch(r.body.reply, /様様/);
});
