import test from "node:test";
import assert from "node:assert/strict";
import { FACTS } from "../src/facts.js";

test("facts: 見積の方針が入り、金額(円)は入っていない", () => {
  assert.match(FACTS, /溶接は日当/);
  assert.match(FACTS, /能力と作業の内容/);
  // 康さんが決めていない具体的な金額が混ざっていないこと(数字+円)
  const estimate = FACTS.split("\n").find((l) => l.startsWith("見積の目安:")) || "";
  assert.doesNotMatch(estimate.replace("具体的な金額(円)", ""), /[0-9０-９,]+\s*円/);
});

test("facts: 連絡先が入っている", () => {
  assert.match(FACTS, /03-6805-6474/);
  assert.match(FACTS, /takumikougyou\.1105@gmail\.com/);
});
