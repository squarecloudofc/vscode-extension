/**
 * The realtime console prints application output, not the metrics the same
 * stream carries.
 *
 *   node scripts/check-realtime.mjs
 *
 * The events below are what the SDK yields for the endpoint's wire format.
 * Fails if `status` or `system` frames start leaking into the console again,
 * if the raw `data` (with its stdout/stderr prefix byte) is printed instead of
 * the parsed `line`, or if log indentation is lost.
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
       export const commands = {}, env = {}, Uri = {};
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
      "export class SquareCloudAPIError extends Error {}",
    ),
  },
});

const { printableLine } = await import(pathToFileURL(bundle).href);

// Events as the SDK yields them: SSE frames already split, the stdout/stderr
// byte already stripped into `stream`, status frames merged.
const EVENTS = [
  {
    event: "system",
    data: "REALTIME_CONNECTING | abc123-1716000000000-deadbeef",
  },
  {
    event: "status",
    data: '{"cpu":12.5,"ram":[128,512],"netIO":{"i":2048,"o":4096}}',
    status: { cpu: 12.5, ram: [128, 512], netIO: { i: 2048, o: 4096 } },
  },
  {
    event: "logs",
    data: "Server listening on :3000",
    stream: "stdout",
    line: "Server listening on :3000",
  },
  {
    event: "logs",
    data: "Error: connect ECONNREFUSED",
    stream: "stderr",
    line: "Error: connect ECONNREFUSED",
  },
  {
    event: "logs",
    data: "    at TCPConnectWrap.afterConnect",
    stream: "stderr",
    line: "    at TCPConnectWrap.afterConnect",
  },
  { event: "error", data: "REALTIME_ERROR" },
];

const lines = EVENTS.map(printableLine).filter((line) => line !== undefined);

assert.deepEqual(lines, [
  "Server listening on :3000",
  "Error: connect ECONNREFUSED",
  // Indentation survives: the console prints the SDK's `line` untouched.
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
