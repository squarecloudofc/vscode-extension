import assert from "node:assert/strict";
import { test } from "node:test";

import { capLines, mergeLogs, splitLogs } from "../src/webview/lib/logs.ts";

const merge = (a: string[], b: string[]) => mergeLogs(a, b, (s) => s);

test("splitLogs drops the trailing newline and takes CRLF", () => {
  assert.deepEqual(splitLogs(""), []);
  assert.deepEqual(splitLogs("a\r\nb\n"), ["a", "b"]);
  assert.deepEqual(splitLogs("a\n\nb"), ["a", "", "b"]);
});

test("a replay of what is on screen adds only the new lines", () => {
  assert.deepEqual(merge(["a", "b", "c"], ["a", "b", "c", "d", "e"]), [
    "a",
    "b",
    "c",
    "d",
    "e",
  ]);
  // The replay starts later than the buffer.
  assert.deepEqual(merge(["a", "b", "c"], ["b", "c", "d"]), [
    "a",
    "b",
    "c",
    "d",
  ]);
});

test("no overlap keeps everything", () => {
  assert.deepEqual(merge(["a", "b"], ["x", "y"]), ["a", "b", "x", "y"]);
  assert.deepEqual(merge([], ["x"]), ["x"]);
  assert.deepEqual(merge(["a"], []), ["a"]);
});

test("the match needs the lines before it too", () => {
  // "c" alone matches, but its neighbours don't: not the same place.
  assert.deepEqual(merge(["a", "b", "c"], ["x", "c", "d"]), [
    "a",
    "b",
    "c",
    "x",
    "c",
    "d",
  ]);
});

test("history arriving after live lines", () => {
  // The stream replayed history and went on; the history call answers late.
  assert.deepEqual(merge(["h1", "h2"], ["h1", "h2", "n1"]), ["h1", "h2", "n1"]);
});

test("capLines keeps the newest", () => {
  assert.deepEqual(capLines([1, 2, 3, 4], 2), [3, 4]);
  assert.deepEqual(capLines([1], 2), [1]);
});
