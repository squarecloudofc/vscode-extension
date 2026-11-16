import assert from "node:assert/strict";
import { test } from "node:test";

import { matchesLog, parseAnsi, plainText } from "../src/webview/lib/ansi.ts";

const ESC = "\x1b";

test("plain text is one segment, empty is none", () => {
  assert.deepEqual(parseAnsi("ready on :80"), [{ text: "ready on :80" }]);
  assert.deepEqual(parseAnsi(""), []);
});

test("4-bit colours, bold and reset", () => {
  assert.deepEqual(parseAnsi(`${ESC}[1;31merror${ESC}[0m done`), [
    { text: "error", style: { bold: true, color: "#ef4444" } },
    { text: " done" },
  ]);
  assert.deepEqual(parseAnsi(`${ESC}[32mok${ESC}[39m`), [
    { text: "ok", style: { color: "#22c55e" } },
  ]);
  assert.deepEqual(parseAnsi(`${ESC}[41mbg`), [
    { text: "bg", style: { background: "#b91c1c" } },
  ]);
});

test("256 and truecolor", () => {
  assert.deepEqual(parseAnsi(`${ESC}[38;5;196mx`), [
    { text: "x", style: { color: "rgb(255,0,0)" } },
  ]);
  assert.deepEqual(parseAnsi(`${ESC}[38;5;1mx`), [
    { text: "x", style: { color: "#ef4444" } },
  ]);
  assert.deepEqual(parseAnsi(`${ESC}[48;2;10;20;30mx`), [
    { text: "x", style: { background: "rgb(10,20,30)" } },
  ]);
});

test("a bare ESC[m resets", () => {
  assert.deepEqual(parseAnsi(`${ESC}[3mi${ESC}[mn`), [
    { text: "i", style: { italic: true } },
    { text: "n" },
  ]);
});

test("cursor moves, line clears and OSC links are dropped", () => {
  assert.deepEqual(parseAnsi(`${ESC}[2K${ESC}[1Gprogress 40%`), [
    { text: "progress 40%" },
  ]);
  assert.deepEqual(
    parseAnsi(`${ESC}]8;;https://example.com${ESC}\\link${ESC}]8;;${ESC}\\`),
    [{ text: "link" }],
  );
});

test("styles carry across segments until changed", () => {
  const [a, b] = parseAnsi(`${ESC}[4;33mwarn${ESC}[22m still`);
  assert.deepEqual(a, {
    text: "warn",
    style: { underline: true, color: "#eab308" },
  });
  assert.deepEqual(b, {
    text: " still",
    style: { underline: true, color: "#eab308" },
  });
});

test("plainText drops escape codes; matchesLog searches what shows", () => {
  const line = `${ESC}[31mError${ESC}[0m: connect ${ESC}]8;;https://x${ESC}\\ECONNREFUSED`;
  assert.equal(plainText(line), "Error: connect ECONNREFUSED");
  assert.ok(matchesLog(line, "error: CONNECT"));
  assert.ok(matchesLog(line, "  "));
  assert.equal(matchesLog(line, "31m"), false);
});

test("charset, cursor-save and keypad escapes are dropped, not printed", () => {
  for (const seq of ["(B", ")0", "7", "8", "=", ">", "c", "M"])
    assert.equal(plainText(`a${ESC}${seq}b`), "ab", JSON.stringify(seq));
  assert.deepEqual(parseAnsi(`${ESC}(B${ESC}[31mred${ESC}(B${ESC}[m`), [
    { text: "red", style: { color: "#ef4444" } },
  ]);
  assert.equal(matchesLog(`${ESC}7saved${ESC}8`, "7saved"), false);
  assert.ok(matchesLog(`${ESC}7saved${ESC}8`, "saved"));
});
