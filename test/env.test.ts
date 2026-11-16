import assert from "node:assert/strict";
import { test } from "node:test";

import { parseEnv } from "../src/webview/lib/env.ts";

test("KEY=value lines, comments and blanks skipped", () => {
  const { vars, skipped } = parseEnv(
    [
      "# database",
      "",
      "DATABASE_URL=postgres://bot@db:5432/bot",
      "export NODE_ENV=production",
      "  PORT = 80  ",
      "EMPTY=",
    ].join("\n"),
  );
  assert.deepEqual(vars, [
    ["DATABASE_URL", "postgres://bot@db:5432/bot"],
    ["NODE_ENV", "production"],
    ["PORT", "80"],
    ["EMPTY", ""],
  ]);
  assert.deepEqual(skipped, []);
});

test("quoted values keep their quotes, as shellQuote expects", () => {
  const { vars } = parseEnv(
    [
      'GREETING="hello world" # said once',
      "RAW='pa$$word'",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: refers to another variable
      'URL="${HOST}:3000"',
      'ESCAPED="say \\"hi\\""',
      "HASH='a # b'",
    ].join("\r\n"),
  );
  assert.deepEqual(vars, [
    ["GREETING", '"hello world"'],
    ["RAW", "'pa$$word'"],
    // biome-ignore lint/suspicious/noTemplateCurlyInString: refers to another variable
    ["URL", '"${HOST}:3000"'],
    ["ESCAPED", '"say \\"hi\\""'],
    ["HASH", "'a # b'"],
  ]);
});

test("an unquoted value ends at a comment", () => {
  assert.deepEqual(parseEnv("A=b # note\nC=d#e").vars, [
    ["A", "b"],
    ["C", "d#e"],
  ]);
});

test("a quoted value may span lines", () => {
  const { vars, skipped } = parseEnv(
    'KEY="-----BEGIN-----\nabc\n-----END-----"\nNEXT=1',
  );
  assert.deepEqual(vars, [
    ["KEY", '"-----BEGIN-----\nabc\n-----END-----"'],
    ["NEXT", "1"],
  ]);
  assert.deepEqual(skipped, []);
});

test("bad lines are reported by number; the last repeat wins", () => {
  const { vars, skipped } = parseEnv(
    ["A=1", "not a variable", "1BAD=x", "=x", 'Q="open', "A=2"].join("\n"),
  );
  assert.deepEqual(vars, [["A", "2"]]);
  // An unclosed quote costs its own line, not the ones after it.
  assert.deepEqual(skipped, [2, 3, 4, 5]);
});

test("text after a closing quote is not a value", () => {
  assert.deepEqual(parseEnv("A='x' y").skipped, [1]);
});

test("an unclosed quote doesn't swallow the next line", () => {
  // The quote that "closes" A is B's opening one: A is the bad line.
  const { vars, skipped } = parseEnv('A="unclosed\nB="x"\nC=1');
  assert.deepEqual(vars, [
    ["B", '"x"'],
    ["C", "1"],
  ]);
  assert.deepEqual(skipped, [1]);
});
