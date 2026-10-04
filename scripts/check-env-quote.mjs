/**
 * Env values go through `source .squarecloud/.env` in the container, so the
 * extension quotes them like the CLI does (shellQuote in env.go).
 *
 *   node scripts/check-env-quote.mjs
 *
 * Fails if a value bash would split or expand is sent raw, if a value the
 * user already quoted gets quoted again, or if quoting twice changes it.
 */
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const esbuild = createRequire(join(process.cwd(), "package.json"))("esbuild");

const bundle = join(mkdtempSync(join(tmpdir(), "sq-env-quote-")), "format.mjs");
await esbuild.build({
  entryPoints: ["src/lib/utils/format.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
});
const { shellQuote } = await import(pathToFileURL(bundle).href);

const cases = {
  abc: "abc",
  "a.b-c/d:1": "a.b-c/d:1",
  ção: "ção",
  "hello world": "'hello world'",
  pa$$word: "'pa$$word'",
  "x&y": "'x&y'",
  "it's ok": `"it's ok"`,
  "it's $HOME": `"it's \\$HOME"`,
  "'já'": "'já'",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: the value refers to another variable
  '"${HOST}:3000"': '"${HOST}:3000"',
  '"a\\"': `'"a\\"'`, // the \ escapes the closing quote: not quoted
  "": "",
};

for (const [value, want] of Object.entries(cases)) {
  const got = shellQuote(value);
  assert.equal(got, want, `shellQuote(${JSON.stringify(value)})`);
  assert.equal(
    shellQuote(got),
    got,
    `shellQuote twice on ${JSON.stringify(value)}`,
  );
}

console.log("check-env-quote: ok");
