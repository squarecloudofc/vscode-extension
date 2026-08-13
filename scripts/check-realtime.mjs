/**
 * The realtime console prints application output, not the metrics the same
 * stream carries.
 *
 *   node scripts/check-realtime.mjs
 *
 * The chunk below is the wire format from the endpoint's documentation. Fails
 * if `status` or `system` frames start leaking into the console again, if the
 * stdout/stderr prefix byte stops being stripped, or if log indentation is
 * eaten by the `data:` unwrapping.
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const esbuild = createRequire(join(process.cwd(), "package.json"))("esbuild");

const dir = mkdtempSync(join(tmpdir(), "sq-realtime-"));
const stub = (name, source) => {
  const file = join(dir, name);
  writeFileSync(file, source);
  return file;
};

const bundle = join(dir, "realtime.mjs");
await esbuild.build({
  entryPoints: ["src/commands/applications/tools/realtime.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  alias: {
    // Enough of the API for the module's import-time side effects (the shared
    // Logger builds an output channel as soon as it loads).
    vscode: stub(
      "vscode.mjs",
      `const noop = () => {};
       const channel = { appendLine: noop, show: noop, dispose: noop, replace: noop, clear: noop };
       export const window = {
         createOutputChannel: () => channel,
         showErrorMessage: noop,
         showInformationMessage: noop,
       };`,
    ),
    "vscode-ext-localisation": stub(
      "i18n.mjs",
      "export const t = (key) => key;",
    ),
    "@squarecloud/api": stub(
      "sdk.mjs",
      `export class SquareCloudAPIError extends Error {}
       export const APIErrorCode = {};`,
    ),
  },
});

const { extractPrintableLines } = await import(pathToFileURL(bundle).href);

const CHUNK = [
  "event: system",
  "data: REALTIME_CONNECTING | abc123-1716000000000-deadbeef",
  "",
  "event: status",
  'data: {"cpu":12.5,"cpuLimit":100,"ram":[128,512],"status":"running","netIO":{"i":2048,"o":4096},"bIO":{"i":0,"o":0},"uptime":1716000000000}',
  "",
  "event: logs",
  "data: \x01Server listening on :3000",
  "",
  "event: status",
  'data: {"cpu":13.1,"ram":[131,512],"netIO":{"i":2176,"o":4288}}',
  "",
  "event: logs",
  "data: \x02Error: connect ECONNREFUSED",
  "",
  "event: logs",
  "data: \x02    at TCPConnectWrap.afterConnect",
  "",
  "event: error",
  "data: REALTIME_ERROR",
].join("\n");

const lines = extractPrintableLines(CHUNK);

assert.deepEqual(lines, [
  "Server listening on :3000",
  "Error: connect ECONNREFUSED",
  // Indentation survives: exactly one space is stripped after `data:`, and the
  // stream-id byte is not whitespace.
  "    at TCPConnectWrap.afterConnect",
  "REALTIME_ERROR",
]);

assert.ok(
  !lines.some((line) => line.includes("cpu") || line.includes("netIO")),
  "status metrics must never reach the console",
);
assert.ok(
  !lines.some((line) => line.includes("REALTIME_CONNECTING")),
  "system signals are narrated by the command itself",
);

console.log("realtime console: ok");
