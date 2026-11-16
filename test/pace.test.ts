import assert from "node:assert/strict";
import { test } from "node:test";

import { paced, pacer } from "../src/lib/utils/pace.ts";

const busy = (e: unknown) => (e as { code?: string }).code === "KEEP_CALM";

test("writes are spaced and a busy refusal waits, then goes on", async () => {
  const waits: number[] = [];
  const sent: string[] = [];
  let refused = false;
  const result = await paced(
    ["a", "b", "c"],
    async (item) => {
      if (item === "b" && !refused) {
        refused = true;
        throw { code: "KEEP_CALM" };
      }
      sent.push(item);
    },
    {
      gapMs: 500,
      retryMs: 5000,
      busy,
      wait: async (ms) => void waits.push(ms),
    },
  );
  assert.deepEqual(result, { done: 3 });
  assert.deepEqual(sent, ["a", "b", "c"]);
  // The busy wait is there, and every later start is spaced (≈ 500 ms).
  assert.ok(waits.includes(5000));
  assert.ok(waits.filter((ms) => ms !== 5000).every((ms) => ms > 400));
});

test("any other failure stops and says how many went", async () => {
  const error = { code: "WRITE_FAILED" };
  const result = await paced(
    [1, 2, 3],
    async (n) => {
      if (n === 3) throw error;
    },
    { gapMs: 0, busy, wait: async () => undefined },
  );
  assert.deepEqual(result, { done: 2, error });
});

test("a refusal that keeps coming stops after the retries", async () => {
  let calls = 0;
  const result = await paced(
    ["x"],
    async () => {
      calls++;
      throw { code: "KEEP_CALM" };
    },
    { gapMs: 0, retries: 2, busy, wait: async () => undefined },
  );
  assert.equal(result.done, 0);
  assert.equal(calls, 3);
});

test("pacer: calls made at once go one by one, spaced, and wait out KEEP_CALM", async () => {
  const waits: number[] = [];
  const order: string[] = [];
  let running = 0;
  let refused = false;
  const run = pacer({
    gapMs: 500,
    retryMs: 5000,
    busy,
    wait: async (ms) => void waits.push(ms),
  });
  const write = (name: string) =>
    run(async () => {
      running++;
      assert.equal(running, 1, "one write at a time");
      await Promise.resolve();
      running--;
      if (name === "b" && !refused) {
        refused = true;
        throw { code: "KEEP_CALM" };
      }
      order.push(name);
      return name;
    });
  // Save All: every editor's write at the same moment.
  assert.deepEqual(await Promise.all(["a", "b", "c"].map(write)), [
    "a",
    "b",
    "c",
  ]);
  assert.deepEqual(order, ["a", "b", "c"]);
  assert.ok(waits.includes(5000));
  assert.ok(waits.filter((ms) => ms !== 5000).every((ms) => ms > 400));
});

test("pacer: a failure rejects its own call only", async () => {
  const run = pacer({ gapMs: 0, busy, wait: async () => undefined });
  const failed = run(async () => {
    throw { code: "WRITE_FAILED" };
  });
  await assert.rejects(failed, { code: "WRITE_FAILED" });
  assert.equal(await run(async () => "next"), "next");
});
