import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isFinal,
  joinRestore,
  nextRestore,
  settleRestore,
  startRestore,
} from "../src/webview/lib/restore.ts";

const CLICK = Date.UTC(2026, 10, 15, 12, 0);

test("queued and running show the step until it ends", () => {
  let follow = startRestore(CLICK);
  follow = nextRestore(follow, { state: "none" });
  assert.equal(follow.phase, "waiting");
  follow = nextRestore(follow, { state: "queued" });
  assert.deepEqual([follow.phase, follow.step], ["running", "queued"]);
  follow = nextRestore(follow, {
    state: "running",
    step: "unzip",
    started_at: CLICK + 1000,
  });
  assert.deepEqual([follow.phase, follow.step], ["running", "unzip"]);
  follow = nextRestore(follow, {
    state: "success",
    step: "done",
    started_at: CLICK + 1000,
    finished_at: CLICK + 9000,
  });
  assert.equal(follow.phase, "success");
  assert.equal(follow.step, undefined);
  assert.ok(isFinal(follow.phase));
});

test("an error keeps its code", () => {
  const follow = nextRestore(startRestore(CLICK), {
    state: "error",
    code: "SNAPSHOT_CORRUPT",
    started_at: CLICK + 500,
  });
  assert.deepEqual([follow.phase, follow.code], ["error", "SNAPSHOT_CORRUPT"]);
});

test("an earlier restore's result is not this one's", () => {
  const stale = {
    state: "success" as const,
    started_at: CLICK - 30 * 60_000,
    finished_at: CLICK - 29 * 60_000,
  };
  const follow = nextRestore(startRestore(CLICK), stale);
  assert.equal(follow.phase, "waiting");
  // Once the request answered, there is no record of this run.
  assert.equal(
    nextRestore(settleRestore(follow, true), stale).phase,
    "unknown",
  );
});

test("the request's own answer: done, or still running", () => {
  assert.equal(settleRestore(startRestore(CLICK), false).phase, "success");
  const pending = settleRestore(startRestore(CLICK), true);
  assert.deepEqual([pending.phase, pending.posted], ["waiting", true]);
  assert.equal(nextRestore(pending, { state: "none" }).phase, "unknown");
});

test("a final phase stays put", () => {
  const failed = nextRestore(startRestore(CLICK), {
    state: "error",
    started_at: CLICK,
  });
  assert.equal(settleRestore(failed, false).phase, "error");
  assert.equal(nextRestore(failed, { state: "running" }).phase, "error");
});

test("joining a run that was already going takes its result", () => {
  const follow = nextRestore(joinRestore(), {
    state: "success",
    started_at: CLICK - 60 * 60_000,
  });
  assert.equal(follow.phase, "success");
  assert.equal(nextRestore(joinRestore(), { state: "none" }).phase, "unknown");
});
