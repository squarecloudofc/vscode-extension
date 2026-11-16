import assert from "node:assert/strict";
import { test } from "node:test";

import { docsUrl } from "../src/lib/constants.ts";

test("the docs open in VS Code's language, as the site spells it", () => {
  assert.equal(docsUrl("pt-br"), "https://docs.squarecloud.app/pt-BR");
  assert.equal(docsUrl("zh-cn"), "https://docs.squarecloud.app/zh");
  assert.equal(docsUrl("ja"), "https://docs.squarecloud.app/ja");
  assert.equal(docsUrl("de"), "https://docs.squarecloud.app/de");
});

test("a language the docs lack falls back to English", () => {
  assert.equal(docsUrl("en"), "https://docs.squarecloud.app/en");
  assert.equal(docsUrl("pt"), "https://docs.squarecloud.app/en");
  assert.equal(docsUrl("ko"), "https://docs.squarecloud.app/en");
});
