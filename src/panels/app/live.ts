// The app panel's live readings, from the realtime stream's status frames
// or, while there is no stream, from `apps.status`. Pure (type imports
// only): `node --test` and scripts/check-realtime.mjs load it directly.

import type {
  RealtimeEvent,
  RealtimeStatus,
  RuntimeStats,
} from "@squarecloud/api";

import type { AppLive } from "@/webview/protocol";

/**
 * What the console prints of one event: a log line, or an error code the
 * stream reports. `status` frames (several a second) feed the stats instead,
 * and `system` signals are protocol noise. The SDK has already split the
 * frames and moved the stdout/stderr byte into `stream`.
 */
export function printableLine(event: RealtimeEvent): string | undefined {
  if (event.event === "logs") return event.line;
  if (event.event === "error") return event.data;
  return undefined;
}

/**
 * A status frame onto the last readings. Lean frames carry only the live
 * fields (cpu, ram, netIO); the rest keeps its last value. `netIO.new` is
 * bytes per second; `storage` comes now and then (it isn't in the SDK type).
 */
export function liveFromFrame(
  prev: AppLive,
  frame: RealtimeStatus & { storage?: number },
  at: number,
): AppLive {
  return {
    ...prev,
    running: frame.status ? frame.status === "running" : true,
    cpu: frame.cpu ?? prev.cpu,
    ramUsed: frame.ram?.[0] ?? prev.ramUsed,
    ramLimit: frame.ram?.[1] ?? prev.ramLimit,
    netIn: frame.netIO?.new?.i ?? prev.netIn,
    netOut: frame.netIO?.new?.o ?? prev.netOut,
    storage: frame.storage || prev.storage,
    uptime: frame.uptime ?? prev.uptime,
    at,
  };
}

/** `apps.status(id, { raw: true })` onto the last readings. */
export function liveFromStats(
  prev: AppLive,
  stats: RuntimeStats<true>,
  at: number,
): AppLive {
  return {
    ...prev,
    running: stats.running,
    restoring: Boolean(stats.restoring),
    cpu: stats.running ? stats.cpu : undefined,
    ramUsed: stats.running ? stats.ram : undefined,
    netIn: stats.running ? stats.network.now[0] : undefined,
    netOut: stats.running ? stats.network.now[1] : undefined,
    // 0 is "no reading".
    storage: stats.storage || prev.storage,
    uptime: stats.uptime,
    at,
  };
}
