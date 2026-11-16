import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Every colour token needs a value in high contrast (the first `body`
// block, VS Code's colours), in Square's dark theme and in its light theme:
// a token missing from one theme silently inherits the wrong one.
const css = readFileSync(
  new URL("../src/webview/styles/tokens.css", import.meta.url),
  "utf-8",
).replace(/\/\*[\s\S]*?\*\//g, "");

const blocks = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
  selector: (m[1] ?? "").replace(/\s+/g, " ").trim(),
  tokens: new Set(
    [...(m[2] ?? "").matchAll(/(--sq-[\w-]+)\s*:/g)].map((t) => t[1]),
  ),
}));

const block = (selector: string) => {
  const found = blocks.find((b) => b.selector === selector);
  assert.ok(found, `tokens.css has a "${selector}" block`);
  return found.tokens;
};

test("every colour token has a value in high contrast, dark and light", () => {
  const contrast = block("body");
  const shared = block("body.vscode-dark, body.vscode-light");
  const dark = new Set([...shared, ...block("body.vscode-dark")]);
  const light = new Set([...shared, ...block("body.vscode-light")]);
  assert.deepEqual([...dark].sort(), [...contrast].sort(), "dark vs HC");
  assert.deepEqual([...light].sort(), [...contrast].sort(), "light vs HC");
});

test("the sidebar surface only overrides tokens that exist", () => {
  const contrast = block("body");
  const shape = blocks.filter((b) => b.selector === "body")[1]?.tokens;
  for (const token of block("body.surface-sidebar, .surface-sidebar"))
    assert.ok(
      contrast.has(token) || shape?.has(token),
      `${token} is a known token`,
    );
});
