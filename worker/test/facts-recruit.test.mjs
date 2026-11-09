import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FACTS } from "../src/facts.js";

test("facts: 採用は求人票(13070-62670461)どおり", () => {
  for (const s of ["13070-62670461", "正社員", "25万円〜40万円", "8:00〜17:00", "年間休日108日", "時間外労働なし", "転勤なし", "紹介状", "経験・学歴・資格・年齢は不問"]) {
    assert.ok(FACTS.includes(s), "facts に無い: " + s);
  }
});

test("facts: 求人票に無い条件は答えない方針が書いてある", () => {
  assert.match(FACTS, /賞与、昇給、休憩時間/);
  assert.match(FACTS, /答えず/);
});

test("ページの採用欄と facts の数字が一致している", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  for (const s of ["250,000円〜400,000円", "8:00〜17:00", "108日", "13070-62670461", "転勤なし", "時間外労働なし"]) {
    assert.ok(html.includes(s), "ページに無い: " + s);
  }
  assert.ok(!html.includes("勤務地</strong>現場による"), "古い「現場による」が残っている");
});
