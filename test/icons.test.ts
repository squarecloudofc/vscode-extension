import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// <Icon> draws each Phosphor SVG as its single <path>: an asset with any
// other shape would render blank, so every imported one is checked here.
const source = readFileSync(
  new URL("../src/webview/icons.ts", import.meta.url),
  "utf-8",
);
const imports = [
  ...source.matchAll(/from "@phosphor-icons\/core\/(\w+)\/([\w-]+)\.svg"/g),
];

test("every imported icon is one path in a 256 grid", () => {
  assert.ok(imports.length > 40, "icons found");
  for (const [, weight, name] of imports) {
    const svg = readFileSync(
      new URL(
        `../node_modules/@phosphor-icons/core/assets/${weight}/${name}.svg`,
        import.meta.url,
      ),
      "utf-8",
    );
    assert.match(svg, /viewBox="0 0 256 256"/, name);
    assert.deepEqual(
      [...svg.matchAll(/<(\w+)/g)].map((m) => m[1]),
      ["svg", "path"],
      `${weight}/${name} is a single path`,
    );
    assert.equal([...svg.matchAll(/ d="/g)].length, 1, name);
  }
});
