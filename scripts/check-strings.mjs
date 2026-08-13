/**
 * Every `t("key")` in the source and every `%key%` in package.json must
 * resolve in all three locales.
 *
 *   node scripts/check-strings.mjs
 *
 * A missing key is invisible at runtime — `t()` returns the key itself, so the
 * UI just renders `command.commitEntry` and nobody notices until a screenshot.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const LOCALES = [
  "package.nls.json",
  "package.nls.pt-br.json",
  "package.nls.es.json",
];

const tables = LOCALES.map((file) => ({
  file,
  strings: JSON.parse(readFileSync(file, "utf-8")),
}));

/** Mirrors vscode-ext-localisation: flat key first, then a deep walk. */
function resolves(strings, key) {
  if (typeof strings[key] === "string") return true;
  const value = key.split(".").reduce((node, part) => node?.[part], strings);
  return typeof value === "string";
}

function sources(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory()
      ? sources(path)
      : path.endsWith(".ts")
        ? [path]
        : [];
  });
}

const used = new Map(); // key -> where we first saw it

const PATTERNS = [
  // t("some.key")
  /\bt\(\s*"([^"$]+)"/g,
  // Menu tables hold their keys in `label:` / `group:` fields and hand them to
  // `t(variable)` later, which the call-site pattern above cannot see.
  /\b(?:label|group)\s*:\s*"([^"$]+\.[^"$]+)"/g,
];

for (const file of sources("src")) {
  const code = readFileSync(file, "utf-8");
  for (const pattern of PATTERNS) {
    for (const [, key] of code.matchAll(pattern)) {
      if (!used.has(key)) used.set(key, file);
    }
  }
}

// `%key%` placeholders in the manifest go through the same tables.
const manifest = readFileSync("package.json", "utf-8");
for (const [, key] of manifest.matchAll(/"%([^%"]+)%"/g)) {
  if (!used.has(key)) used.set(key, "package.json");
}

const missing = [];
for (const [key, where] of used) {
  for (const { file, strings } of tables) {
    if (!resolves(strings, key))
      missing.push(`${key} — missing in ${file} (used in ${where})`);
  }
}

assert.equal(
  missing.length,
  0,
  `Unresolved translation keys:\n  ${missing.join("\n  ")}`,
);

console.log(`strings: ok (${used.size} keys × ${tables.length} locales)`);
