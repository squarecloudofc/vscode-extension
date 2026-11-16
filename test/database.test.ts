import assert from "node:assert/strict";
import { test } from "node:test";

import {
  connection,
  engineName,
  isDatabaseName,
  memoryProblem,
  minRam,
} from "../src/webview/lib/database.ts";

test("connection details follow the engine", () => {
  assert.deepEqual(connection("postgres", "abc", 5432), {
    host: "square-cloud-db-abc.squareweb.app",
    user: "squarecloud",
    url: "postgresql://squarecloud:<password>@square-cloud-db-abc.squareweb.app:5432",
  });
  assert.equal(
    connection("redis", "abc", 6379, "s3cret").url,
    "rediss://default:s3cret@square-cloud-db-abc.squareweb.app:6379",
  );
  assert.equal(connection("mongo", "abc", 27017).user, "default");
  assert.equal(engineName("mysql"), "MySQL");
  assert.equal(engineName("other"), "other");
  assert.equal(minRam("redis"), 512);
  assert.equal(minRam("postgres"), 1024);
});

test("names as the API takes them", () => {
  assert.ok(isDatabaseName("main-pg"));
  assert.ok(isDatabaseName("cache 2_b"));
  assert.equal(isDatabaseName(""), false);
  assert.equal(isDatabaseName("   "), false);
  assert.equal(isDatabaseName("a".repeat(33)), false);
  assert.equal(isDatabaseName("dó"), false);
});

test("memory is whole MB within the engine's least and the plan", () => {
  assert.equal(memoryProblem("1024", 1024, 4096), undefined);
  assert.equal(memoryProblem(" 2048 ", 1024, null), undefined);
  assert.equal(memoryProblem("512.5", 512, 4096), "integer");
  assert.equal(memoryProblem("1e3", 512, 4096), "integer");
  assert.equal(memoryProblem("", 512, 4096), "integer");
  assert.equal(memoryProblem("-1", 512, 4096), "integer");
  assert.equal(memoryProblem("256", 512, 4096), "low");
  assert.equal(memoryProblem("8192", 512, 4096), "high");
});
