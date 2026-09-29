/**
 * Each kind of problem picks its own picture, toast button and status bar
 * text, so a code in the wrong bucket gives the wrong advice.
 *
 *   node scripts/check-problems.mjs
 *
 * Fails if a code lands in the wrong kind, if an unknown 429 or 5xx stops
 * being recognised, or if the table names a code that neither the SDK
 * declares nor the extension localises (`apiError.*`) — a typo there is a
 * code that silently never matches.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const esbuild = createRequire(join(process.cwd(), "package.json"))("esbuild");

const dir = mkdtempSync(join(tmpdir(), "sq-problems-"));
const stub = (name, source) => {
  const file = join(dir, name);
  writeFileSync(file, source);
  return file;
};

const bundle = join(dir, "problems.mjs");
await esbuild.build({
  stdin: {
    contents: `export { PROBLEM_CODES, problemOf } from "./src/lib/utils/errors";
               export { SquareCloudAPIError } from "@squarecloud/api";`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  alias: {
    vscode: stub(
      "vscode.mjs",
      "export const commands = {}, env = {}, Uri = {}, window = {};",
    ),
    "vscode-ext-localisation": stub(
      "i18n.mjs",
      "export const t = (key) => key;",
    ),
    "@squarecloud/api": stub(
      "sdk.mjs",
      `export class SquareCloudAPIError extends Error {
         constructor(status, code) {
           super(code);
           Object.assign(this, { status, code });
         }
       }`,
    ),
  },
});

const { PROBLEM_CODES, problemOf, SquareCloudAPIError } = await import(
  pathToFileURL(bundle).href
);
const api = (status, code) => new SquareCloudAPIError(status, code);

assert.equal(problemOf(api(0, "NETWORK_ERROR")), "offline");
assert.equal(problemOf("TIMEOUT"), "offline");
assert.equal(problemOf(api(401, "ACCESS_DENIED")), "session");
assert.equal(problemOf("INVALID_GRANT"), "session");
assert.equal(problemOf(api(429, "RATE_LIMITED")), "rateLimit");
assert.equal(problemOf("KEEP_CALM"), "rateLimit");
assert.equal(problemOf(api(429, "SOMETHING_NEW")), "rateLimit");
assert.equal(problemOf("APIKEY_LIMIT_REACHED"), "keyLimit");
assert.equal(problemOf(api(503, "UPLOAD_BUSY")), "outage");
assert.equal(problemOf(api(502, "UNKNOWN_ERROR_502")), "outage");
assert.equal(problemOf(api(403, "UPGRADE_REQUIRED")), "plan");
assert.equal(problemOf(api(404, "APP_NOT_FOUND")), "notFound");
assert.equal(problemOf(api(409, "CONTAINER_ALREADY_STARTED")), "error");
assert.equal(problemOf(api(400, "VALIDATION_FAILED")), "error");
assert.equal(problemOf(new Error("boom")), "error");
assert.equal(problemOf(undefined), "error");

// Every mapped code is one the SDK declares, or one the authorize flow names
// and the extension localises.
const types = readFileSync(
  "node_modules/@squarecloud/api/lib/index.d.mts",
  "utf-8",
);
const union = types.match(/export type ErrorCode =([\s\S]*?)\(string & \{\}\)/);
assert.ok(union, "ErrorCode union not found in the SDK's type declarations");
const declared = new Set(
  union[1].match(/"[A-Z_]+"/g).map((c) => c.slice(1, -1)),
);
const localised = JSON.parse(
  readFileSync("package.nls.json", "utf-8"),
).apiError;
const flow = readFileSync("src/lib/api-key/authorize.ts", "utf-8").match(
  /\b[A-Z][A-Z_]{3,}\b/g,
);
const unknown = Object.values(PROBLEM_CODES)
  .flat()
  .filter(
    (code) =>
      !declared.has(code) && !(flow.includes(code) && code in localised),
  );
assert.deepEqual(unknown, [], `codes the SDK doesn't have: ${unknown}`);

console.log("problems: ok");
