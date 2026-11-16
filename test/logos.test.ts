import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import { logoPath, logoUrl, setLogoBase } from "../src/webview/lib/logos.ts";

const brand = new URL("../resources/brand/", import.meta.url);

test("every runtime and engine the API sends has a logo file", () => {
  const values = [
    ["app", "javascript"],
    ["app", "typescript"],
    ["app", "python"],
    ["app", "golang"],
    ["app", "html"],
    ["app", "c#"],
    ["app", "Elixir"],
    ["database", "postgres"],
    ["database", "redis"],
  ] as const;
  for (const [kind, value] of values) {
    const path = logoPath(kind, value);
    assert.ok(path, `${kind} ${value} has a logo`);
    assert.ok(existsSync(new URL(path, brand)), `${path} exists`);
  }
});

test("aliases share a file, unknown values fall back", () => {
  assert.equal(logoPath("app", "golang"), "languages/go.svg");
  assert.equal(logoPath("app", "html"), "languages/static.svg");
  assert.equal(logoPath("app", "cobol"), undefined);
  assert.equal(logoPath("app", null), undefined);
  assert.equal(logoPath("database", "javascript"), undefined);
});

test("logoUrl joins the webview's base", () => {
  setLogoBase("https://file+.vscode-resource/brand/");
  assert.equal(
    logoUrl("database", "mongo"),
    "https://file+.vscode-resource/brand/databases/mongo.svg",
  );
  assert.equal(logoUrl("app", "unknown"), undefined);
});
