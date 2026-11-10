import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

test("サイトの中心は、仕事・求人・問い合わせ。AIの宣伝はしない", () => {
  // 見せる文章から、AIの宣伝を外した(チャット窓の「自動応答(AI)です」の注記だけは、正直な表示として残す)
  const visible = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<meta[^>]*>/g, "");
  const lines = visible.split("\n").filter((l) => /AI/.test(l) && !/GODO KAISHA/.test(l) && !/id="chat-note"/.test(l));
  assert.deepEqual(lines, [], "AIの文言が残っている: " + lines.join(" | "));
  assert.doesNotMatch(html, /AIに質問・相談する/);
  assert.match(html, /ご相談・お問い合わせ/);
});

test("チャットの受付は、自分からAIと名乗らない(聞かれたら正直に答える)", () => {
  assert.match(worker, /聞かれたら正直に答える。ただし、自分から「AIの受付担当です」と名乗ったり/);
});

test("ポップ化は入れていない(縁取りの影・丸ゴシックのフォント読み込みが無い)", () => {
  assert.doesNotMatch(html, /Mochiy Pop One/);
  assert.doesNotMatch(html, /POP仕上げ/);
});
