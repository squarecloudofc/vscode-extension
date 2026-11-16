/**
 * The app panel's console prints application output, not the metrics the
 * same stream carries.
 *
 *   node scripts/check-realtime.mjs
 *
 * The events below are what the SDK yields for the endpoint's wire format.
 * Fails if `status` or `system` frames start leaking into the console again,
 * if the raw `data` (with its stdout/stderr prefix byte) is printed instead of
 * the parsed `line`, or if log indentation is lost.
 */
import assert from "node:assert/strict";

// Pure TypeScript (type imports only): Node strips the types itself.
const { printableLine } = await import("../src/panels/app/live.ts");

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
  "system signals are protocol noise, never console lines",
);

console.log("realtime console: ok");
