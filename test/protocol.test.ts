import assert from "node:assert/strict";
import { test } from "node:test";

import { isPanelInit, isViewMessage } from "../src/webview/protocol.ts";

test("isViewMessage accepts the two message shapes", () => {
  assert.ok(isViewMessage({ type: "ready" }));
  assert.ok(
    isViewMessage({ type: "rpc", id: 1, method: "app.get", params: {} }),
  );
  assert.ok(isViewMessage({ type: "rpc", id: 2, method: "x" }));
});

test("isViewMessage drops anything else", () => {
  for (const value of [
    null,
    "ready",
    {},
    { type: "rpc", id: "1", method: "x" },
    { type: "rpc", id: 1.5, method: "x" },
    { type: "rpc", id: 1 },
    { type: "state", view: "app", state: {} },
  ])
    assert.equal(isViewMessage(value), false, JSON.stringify(value));
});

test("isPanelInit needs an id", () => {
  assert.ok(isPanelInit({ id: "a1b2" }));
  assert.ok(isPanelInit({ id: "a1b2", tab: "logs" }));
  assert.equal(isPanelInit({ id: "" }), false);
  assert.equal(isPanelInit({ id: "a", tab: 3 }), false);
  assert.equal(isPanelInit(undefined), false);
});
