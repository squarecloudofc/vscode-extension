import assert from "node:assert/strict";
import { test } from "node:test";

import {
  childPath,
  fsErrorKind,
  normalizePath,
  parentOf,
  pathProblem,
  sortEntries,
  splitUriPath,
} from "../src/webview/lib/files.ts";

test("a URI path splits into the app and an absolute API path", () => {
  assert.deepEqual(splitUriPath("/a1b2/src/index.js"), {
    appId: "a1b2",
    path: "/src/index.js",
  });
  assert.deepEqual(splitUriPath("/a1b2"), { appId: "a1b2", path: "/" });
  assert.deepEqual(splitUriPath("/a1b2/"), { appId: "a1b2", path: "/" });
  assert.deepEqual(splitUriPath("/a1b2-w9/x//y/"), {
    appId: "a1b2-w9",
    path: "/x/y",
  });
  assert.equal(splitUriPath("/"), undefined);
  assert.equal(splitUriPath("/a1b2/../other"), undefined);
});

test("paths: parent, normalize", () => {
  assert.equal(parentOf("/src/index.js"), "/src");
  assert.equal(parentOf("/index.js"), "/");
  assert.equal(normalizePath("a/./b"), undefined);
});

test("long paths are refused before asking; the API judges the rest", () => {
  assert.equal(pathProblem("/.squarecloud/.env"), undefined);
  assert.equal(pathProblem(`/${"a".repeat(255)}`), undefined);
  assert.equal(pathProblem(`/${"a".repeat(256)}`), "long");
});

test("a typed name joins its folder", () => {
  assert.equal(childPath("/", "index.js"), "/index.js");
  assert.equal(childPath("/src", " lib/util.ts "), "/src/lib/util.ts");
  assert.equal(childPath("/src", ""), undefined);
  assert.equal(childPath("/src", "../x"), undefined);
  assert.equal(childPath("/src", "dir/"), undefined);
  assert.equal(childPath("/", "/"), undefined);
});

test("API statuses map to file system errors", () => {
  assert.equal(fsErrorKind(404), "FileNotFound");
  assert.equal(fsErrorKind(403), "NoPermissions");
  assert.equal(fsErrorKind(413), "NoPermissions");
  assert.equal(fsErrorKind(429), "Unavailable");
  assert.equal(fsErrorKind(0), "Unavailable");
  assert.equal(fsErrorKind(503), "Unavailable");
  assert.equal(fsErrorKind(400), undefined);
});

test("folders first, then names in natural order", () => {
  const sorted = sortEntries([
    { name: "b.js", type: "file" as const },
    { name: "src", type: "directory" as const },
    { name: "file10", type: "file" as const },
    { name: "file2", type: "file" as const },
    { name: ".squarecloud", type: "directory" as const },
  ]);
  assert.deepEqual(
    sorted.map((e) => e.name),
    [".squarecloud", "src", "b.js", "file2", "file10"],
  );
});
