/**
 * Every `t("key")` in the source and every `%key%` in package.json must
 * resolve in every locale, and every locale must carry exactly the English
 * keys with the same {{PLACEHOLDERS}}, $(icons) and command: links.
 *
 *   node scripts/check-strings.mjs
 *
 * A missing key is invisible at runtime — `t()` returns the key itself, so the
 * UI just renders `command.commitEntry` and nobody notices until a screenshot.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// English first; every package.nls.<locale>.json next to it is a locale.
const LOCALES = readdirSync(".")
  .filter((file) => /^package\.nls(\.[a-z-]+)?\.json$/.test(file))
  .sort((a, b) =>
    a === "package.nls.json"
      ? -1
      : b === "package.nls.json"
        ? 1
        : a.localeCompare(b),
  );

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
      : /\.tsx?$/.test(path)
        ? [path]
        : [];
  });
}

const used = new Map(); // key -> where we first saw it
// The webview has only the strings its host sends (renderShell's l10n), so a
// key it reads must also appear, quoted, in the host's source.
const webviewKeys = new Map();
let hostSource = "";

// t("some.key"), on the host and in the webview (src/webview/l10n.ts).
const CALL = /\bt\(\s*"([^"$]+)"/g;

for (const file of sources("src")) {
  const code = readFileSync(file, "utf-8");
  const webview = file.replaceAll("\\", "/").startsWith("src/webview/");
  if (!webview) hostSource += code;
  for (const [, key] of code.matchAll(CALL)) {
    if (!used.has(key)) used.set(key, file);
    if (webview && !webviewKeys.has(key)) webviewKeys.set(key, file);
  }
}

// `%key%` placeholders in the manifest go through the same tables.
const manifest = readFileSync("package.json", "utf-8");
for (const [, key] of manifest.matchAll(/"%([^%"]+)%"/g)) {
  if (!used.has(key)) used.set(key, "package.json");
}

// One convention for command titles: squarecloud.<id> is titled %command.<id>%.
const misnamed = JSON.parse(manifest)
  .contributes.commands.filter(
    ({ command, title }) =>
      title !== `%command.${command.replace(/^squarecloud\./, "")}%`,
  )
  .map(({ command, title }) => `${command}: ${title}`);
assert.equal(
  misnamed.length,
  0,
  `Command titles not named %command.<id>%:\n  ${misnamed.join("\n  ")}`,
);

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

const unsent = [...webviewKeys]
  .filter(([key]) => !hostSource.includes(`"${key}"`))
  .map(([key, file]) => `${key} (used in ${file})`);
assert.equal(
  unsent.length,
  0,
  `Webview strings its host never sends (list them in its STRINGS):\n  ${unsent.join("\n  ")}`,
);

// VS Code loads a locale's file INSTEAD of English, not on top of it: a key
// missing there renders as the key itself. So each locale mirrors English.
function flatten(node, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") out.set(prefix + key, value);
    else flatten(value, `${prefix}${key}.`, out);
  }
  return out;
}
const tokens = (text) =>
  (text.match(/\{\{\w+\}\}|\$\([\w-]+\)|command:[\w.]+/g) ?? [])
    .sort()
    .join(" ");
const [english, ...others] = tables.map(({ file, strings }) => ({
  file,
  flat: flatten(strings),
}));
const drift = [];
for (const { file, flat } of others) {
  for (const [key, text] of english.flat) {
    if (!flat.has(key)) drift.push(`${key}: missing in ${file}`);
    else if (tokens(flat.get(key)) !== tokens(text))
      drift.push(
        `${key}: ${file} has [${tokens(flat.get(key))}], English has [${tokens(text)}]`,
      );
  }
  for (const key of flat.keys()) {
    if (!english.flat.has(key))
      drift.push(`${key}: in ${file} but not in English`);
  }
}
assert.equal(
  drift.length,
  0,
  `Locales out of step with English:\n  ${drift.join("\n  ")}`,
);

// A string nothing reads still gets translated and reviewed eight times.
// Keys built at runtime: t(`apiError.${code}`), t(`${action}.loading`).
const DYNAMIC = /^apiError\.|^(start|stop|restart)\.loading$/;
const orphans = [...english.flat.keys()].filter(
  (key) => !used.has(key) && !DYNAMIC.test(key),
);
assert.equal(
  orphans.length,
  0,
  `Strings nothing uses (delete them from every locale):\n  ${orphans.join("\n  ")}`,
);

console.log(
  `strings: ok (${used.size} keys × ${tables.length} locales, ${english.flat.size} strings each)`,
);
