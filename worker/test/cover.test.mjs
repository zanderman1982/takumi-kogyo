import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("note の記事に画像が無いときは、代わりの表紙を作る", () => {
  assert.match(html, /function makeCover\(title\)/);
  assert.match(html, /else \{ a\.appendChild\(makeCover\(n\.title\)\); \}/);
});

test("代わりの表紙の題名は textContent で入れる(HTMLとして解釈しない)", () => {
  const fn = html.slice(html.indexOf("function makeCover"), html.indexOf("// note の最新記事"));
  assert.match(fn, /t\.textContent = head/);
  assert.match(fn, /l\.textContent = "SHINEMON \/ " \+ tag/);
  // innerHTML に入れているのは、固定のSVGだけ(題名や記事の文字を連結していない)
  // 改行コードは、環境によって LF か CRLF になるので、どちらでも通す
  const inner = fn.match(/c\.innerHTML = ([\s\S]*?);\r?\n/)[1];
  assert.ok(!/\b(title|head|tag)\b/.test(inner), "innerHTML に記事の文字が入っている");
});
