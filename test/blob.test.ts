import assert from "node:assert/strict";
import { test } from "node:test";

import {
  crumbs,
  folderName,
  objectName,
  uploadName,
  uploadPrefix,
} from "../src/webview/lib/blob.ts";

test("object and folder names as people read them", () => {
  assert.equal(objectName("pub/123/docs/report.pdf"), "report.pdf");
  assert.equal(objectName("prv/123/a~e1767225600.tar.gz"), "a.tar.gz");
  assert.equal(objectName("legacy.png"), "legacy.png");
  assert.equal(folderName("docs/2026/", "docs/"), "2026");
  assert.equal(folderName("avatars/", ""), "avatars");
});

test("breadcrumbs and the prefix an upload takes", () => {
  assert.deepEqual(crumbs(""), []);
  assert.deepEqual(crumbs("docs/2026/"), [
    { name: "docs", prefix: "docs/" },
    { name: "2026", prefix: "docs/2026/" },
  ]);
  assert.equal(uploadPrefix(""), undefined);
  assert.equal(uploadPrefix("docs/2026/"), "docs/2026");
});

test("a local file's name becomes a valid object name", () => {
  assert.equal(uploadName("photo.png"), "photo");
  assert.equal(uploadName("backup.tar.gz"), "backup");
  assert.equal(uploadName("my report (final).pdf"), "my_report_final_");
  assert.equal(uploadName(".env"), "file");
  assert.equal(uploadName("README"), "README");
  assert.equal(uploadName("build-ex12.zip"), "build_ex12");
  assert.equal(uploadName(`${"a".repeat(200)}.txt`).length, 128);
});
