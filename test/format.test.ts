import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatBytes,
  formatBytesParts,
  formatDateTime,
  formatPercent,
  formatTime,
} from "../src/webview/lib/format.ts";

const NBSP = "\u00a0";

test("formatBytes scales by 1024 and drops trailing zeros", () => {
  assert.equal(formatBytes(0, "en"), `0${NBSP}B`);
  assert.equal(formatBytes(512, "en"), `512${NBSP}B`);
  assert.equal(formatBytes(1536, "en"), `1.5${NBSP}kB`);
  assert.equal(formatBytes(120 * 1024 ** 2, "en"), `120${NBSP}MB`);
  assert.equal(formatBytes(1.2 * 1024 ** 3, "en", 1), `1.2${NBSP}GB`);
});

test("formatBytes follows the locale", () => {
  assert.equal(formatBytes(1.75 * 1024 ** 2, "pt-br"), `1,75${NBSP}MB`);
  assert.equal(formatBytes(1.75 * 1024 ** 2, "fr"), `1,75${NBSP}Mo`);
});

test("formatBytes rounds up into the next unit instead of 1024", () => {
  assert.equal(formatBytes(1024 * 1024 - 1, "en"), `1${NBSP}MB`);
});

test("formatBytes reads bad input as zero", () => {
  assert.equal(formatBytes(-5, "en"), `0${NBSP}B`);
  assert.equal(formatBytes(Number.NaN, "en"), `0${NBSP}B`);
  assert.equal(formatBytes(0.4, "en"), `0.4${NBSP}B`);
});

test("formatBytesParts splits value and unit", () => {
  assert.deepEqual(formatBytesParts(84 * 1024 ** 2, "en"), {
    value: "84",
    unit: "MB",
  });
});

test("formatPercent takes points and follows the locale", () => {
  assert.equal(formatPercent(0.4, "en"), "0.4%");
  assert.equal(formatPercent(12.345, "en"), "12.3%");
  assert.equal(formatPercent(100, "en", 0), "100%");
  assert.equal(formatPercent(0.4, "pt-br"), "0,4%");
  assert.match(formatPercent(0.4, "fr"), /^0,4\s%$/u);
  assert.equal(formatPercent(Number.NaN, "en"), "—");
});

test("formatTime and formatDateTime follow the locale", () => {
  const at = Date.UTC(2026, 10, 15, 15, 2, 11);
  // Rendered in the machine's zone: compare against the same Intl call.
  assert.equal(
    formatTime(at, "en", true),
    new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(at),
  );
  assert.match(formatTime(at, "pt-br"), /^\d{2}:\d{2}$/);
  assert.match(formatDateTime(at, "en", true), /^Nov 1[45]$/);
});

test("formatCount is compact, formatMs switches to seconds", async () => {
  const { formatCount, formatMs } = await import(
    "../src/webview/lib/format.ts"
  );
  assert.equal(formatCount(1234, "en"), "1.2K");
  assert.equal(formatCount(12, "en"), "12");
  assert.equal(formatMs(184.4, "en"), "184 ms");
  assert.equal(formatMs(1234, "en"), "1.2 sec");
  assert.equal(formatMs(null, "en"), "—");
});
