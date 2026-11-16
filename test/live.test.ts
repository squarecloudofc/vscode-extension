import assert from "node:assert/strict";
import { test } from "node:test";

import { liveFromFrame, liveFromStats } from "../src/panels/app/live.ts";

test("a full frame, then lean ones keep what they lack", () => {
  const full = liveFromFrame(
    {},
    {
      cpu: 0.4,
      ram: [120, 512],
      netIO: { i: 9000, o: 4000, new: { i: 1200, o: 300 } },
      status: "running",
      uptime: 1000,
      storage: 84 * 1024 ** 2,
    },
    1,
  );
  assert.deepEqual(full, {
    running: true,
    cpu: 0.4,
    ramUsed: 120,
    ramLimit: 512,
    netIn: 1200,
    netOut: 300,
    storage: 84 * 1024 ** 2,
    uptime: 1000,
    at: 1,
  });
  const lean = liveFromFrame(
    full,
    { cpu: 1.5, ram: [130, 512], netIO: { i: 9100, o: 4100 } },
    2,
  );
  assert.equal(lean.cpu, 1.5);
  assert.equal(lean.ramUsed, 130);
  // No `new` on this frame: the last rate stays.
  assert.equal(lean.netIn, 1200);
  assert.equal(lean.storage, full.storage);
  assert.equal(lean.uptime, 1000);
});

test("apps.status: readings only while running, 0 storage is no reading", () => {
  const running = liveFromStats(
    { storage: 2048 },
    {
      cpu: 2,
      ram: 64,
      status: "running",
      running: true,
      storage: 0,
      network: { total: [1, 1], now: [10, 20] },
      uptime: 5,
    },
    3,
  );
  assert.deepEqual(running, {
    running: true,
    restoring: false,
    cpu: 2,
    ramUsed: 64,
    netIn: 10,
    netOut: 20,
    storage: 2048,
    uptime: 5,
    at: 3,
  });
  const stopped = liveFromStats(
    running,
    {
      cpu: 0,
      ram: 0,
      status: "exited",
      running: false,
      restoring: true,
      storage: 4096,
      network: { total: [0, 0], now: [0, 0] },
      uptime: null,
    },
    4,
  );
  assert.equal(stopped.running, false);
  assert.equal(stopped.restoring, true);
  assert.equal(stopped.cpu, undefined);
  assert.equal(stopped.storage, 4096);
});
