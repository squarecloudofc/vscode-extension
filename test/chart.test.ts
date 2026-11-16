import assert from "node:assert/strict";
import { test } from "node:test";

import {
  linePath,
  niceByteTicks,
  niceTicks,
  yAt,
} from "../src/webview/lib/chart.ts";

test("niceTicks starts at 0 on a 1/2/5 step and covers the max", () => {
  assert.deepEqual(niceTicks(100), [0, 50, 100]);
  assert.deepEqual(niceTicks(7), [0, 2, 4, 6, 8]);
  assert.deepEqual(niceTicks(0.37), [0, 0.1, 0.2, 0.3, 0.4]);
  assert.deepEqual(niceTicks(3), [0, 1, 2, 3]);
  for (const max of [0.001, 1, 9.99, 512, 123456]) {
    const ticks = niceTicks(max);
    assert.equal(ticks[0], 0);
    assert.ok((ticks.at(-1) ?? 0) >= max, `covers ${max}`);
    assert.ok(ticks.length >= 2 && ticks.length <= 6, `count for ${max}`);
  }
});

test("niceTicks of nothing is a 0–1 axis", () => {
  assert.deepEqual(niceTicks(0), [0, 1]);
  assert.deepEqual(niceTicks(Number.NaN), [0, 1]);
  assert.deepEqual(niceTicks(-3), [0, 1]);
});

test("niceByteTicks steps in the display unit", () => {
  const MB = 1024 ** 2;
  assert.deepEqual(
    niceByteTicks(512 * MB),
    [0, 200, 400, 600].map((v) => v * MB),
  );
  assert.deepEqual(niceByteTicks(0), [0, 1]);
});

test("yAt maps 0 to the bottom and the top tick to 0, clamped", () => {
  assert.equal(yAt(0, 100, 200), 200);
  assert.equal(yAt(100, 100, 200), 0);
  assert.equal(yAt(25, 100, 200), 150);
  assert.equal(yAt(-10, 100, 200), 200);
  assert.equal(yAt(500, 100, 200), 0);
  assert.equal(yAt(5, 0, 200), 200);
});

test("linePath draws straight segments", () => {
  assert.equal(linePath([]), "");
  assert.equal(
    linePath([
      [0, 10],
      [5, 5],
      [10, 0],
    ]),
    "M0,10L5,5L10,0",
  );
});

test("linePath monotone never overshoots a sample", () => {
  const points = [
    [0, 100],
    [10, 90],
    [20, 0],
    [30, 0],
    [40, 50],
  ] as const;
  const d = linePath(points, true);
  assert.ok(d.startsWith("M0,100C"));
  assert.ok(!d.includes("NaN"));
  const ys = [...d.matchAll(/[-\d.]+,([-\d.]+)/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= 100, d);
});

test("linePath survives repeated x", () => {
  const d = linePath(
    [
      [0, 1],
      [0, 2],
      [5, 3],
    ],
    true,
  );
  assert.ok(!d.includes("NaN"), d);
});
