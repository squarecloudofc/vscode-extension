import assert from "node:assert/strict";
import { test } from "node:test";

import {
  counterDelta,
  deriveMetrics,
  isWeekly,
  type MetricPointLike,
} from "../src/webview/lib/metrics.ts";

const MB = 1024 * 1024;
const at = (min: number) =>
  new Date(Date.UTC(2026, 10, 15, 12, min)).toISOString();
const point = (
  min: number,
  net: number[],
  extra: Partial<MetricPointLike> = {},
): MetricPointLike => ({ date: at(min), cpu: 1, ram: 100, net, ...extra });

test("counterDelta reads a drop as a restart", () => {
  assert.deepEqual(counterDelta(150, 100), { delta: 50, restarted: false });
  assert.deepEqual(counterDelta(30, 100), { delta: 30, restarted: true });
});

test("rows come oldest first, RAM in bytes, network as a rate", () => {
  // The API answers newest first.
  const rows = deriveMetrics([
    point(10, [3000, 1200]),
    point(5, [1500, 600]),
    point(0, [0, 0]),
  ]);
  assert.deepEqual(
    rows.cpu.map((r) => r.t),
    [0, 5, 10].map((m) => Date.parse(at(m))),
  );
  assert.equal(rows.ram[0]?.value, 100 * MB);
  assert.deepEqual(rows.net[0], {
    t: Date.parse(at(0)),
    input: null,
    output: null,
  });
  assert.equal(rows.net[1]?.input, 1500 / 300);
  assert.equal(rows.net[2]?.output, 600 / 300);
  assert.deepEqual(rows.restarts, []);
  assert.equal(rows.weekly, false);
});

test("a counter that fell marks a restart and counts from zero", () => {
  const rows = deriveMetrics([
    point(0, [9000, 9000]),
    point(5, [9300, 9600]),
    point(10, [600, 300]),
  ]);
  assert.equal(rows.net[2]?.input, 600 / 300);
  assert.deepEqual(rows.restarts, [Date.parse(at(10))]);
});

test("no rate right after a gap", () => {
  const rows = deriveMetrics([
    point(0, [0, 0]),
    point(5, [300, 300]),
    point(10, [600, 600]),
    point(60, [900, 900]),
  ]);
  assert.equal(rows.net[3]?.input, null);
});

test("disk and storage only when there are readings", () => {
  const none = deriveMetrics([point(0, [0, 0]), point(5, [1, 1])]);
  assert.deepEqual(none.disk, []);
  assert.deepEqual(none.storage, []);

  const rows = deriveMetrics([
    point(0, [0, 0], { disk: [100, 50], storage: 2048 }),
    point(5, [1, 1], { disk: null, storage: null }),
    point(10, [2, 2], { disk: [400, 80], storage: 4096 }),
    point(15, [3, 3], { disk: [500, 100], storage: 4096 }),
  ]);
  // A point without a reading is no base for the next.
  assert.deepEqual(
    rows.disk.map((r) => [r.read, r.write]),
    [
      [null, null],
      [null, null],
      [null, null],
      [100, 20],
    ],
  );
  assert.deepEqual(
    rows.storage.map((r) => r.value),
    [2048, null, 4096, 4096],
  );
});

test("7-day points carry peaks; CPU stays within 0–100", () => {
  const week = [
    point(0, [0, 0], { cpu: 120, cpu_max: 150, ram: 200, ram_max: 300 }),
  ];
  assert.ok(isWeekly(week));
  assert.equal(isWeekly([point(0, [0, 0])]), false);
  const rows = deriveMetrics(week);
  assert.equal(rows.weekly, true);
  assert.deepEqual(rows.cpu[0], { t: Date.parse(at(0)), value: 100, max: 100 });
  assert.equal(rows.ram[0]?.max, 300 * MB);
});
