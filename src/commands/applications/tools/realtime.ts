import type { RealtimeEvent } from "@squarecloud/api";
import { window } from "vscode";
import { t } from "vscode-ext-localisation";

import { describeError } from "@/lib/utils/errors";
import { getOutputChannel } from "@/lib/utils/output-channels";
import { ApplicationCommand } from "@/structures/application/command";

/** Short backoff before reconnecting after the server-side TTL closes the stream. */
const RECONNECT_DELAY_MS = 3_000;
/**
 * A healthy stream lives ~10 minutes (server TTL). One that dies faster than
 * this is a refusal or a stopped app — reconnecting would just hammer the
 * endpoint every few seconds.
 */
const MIN_HEALTHY_STREAM_MS = 5_000;

const sessions = new Map<string, AbortController>();

type EventStream = AsyncGenerator<RealtimeEvent, void, undefined>;

/**
 * What a console prints of one event. The stream also carries `status`
 * (cpu/ram/netIO, several times a second) and `system` protocol signals — the
 * former buries the output it is mixed into, and the latter is already
 * narrated by the markers this command writes itself. The SDK has already
 * split the SSE frames and stripped the stdout/stderr prefix byte.
 *
 * Exported for `scripts/check-realtime.mjs`.
 */
export function printableLine(event: RealtimeEvent): string | undefined {
  if (event.event === "logs") return event.line;
  if (event.event === "error") return event.data;
  return undefined;
}

export const realtimeEntry = new ApplicationCommand(
  "realtimeEntry",
  async (extension, { application }, api) => {
    const existing = sessions.get(application.id);
    if (existing) {
      existing.abort();
      sessions.delete(application.id);
      window.showInformationMessage(t("realtime.stopped"));
      return;
    }

    // Reserve the slot BEFORE the network round-trip so a second invocation
    // during the await toggles this session off instead of racing a duplicate
    // stream into the same map entry.
    const controller = new AbortController();
    const { signal } = controller;
    sessions.set(application.id, controller);
    // The map entry may already belong to a newer session by the time this
    // runs (toggle-stop deletes eagerly) — only remove what we own.
    const releaseSlot = () => {
      if (sessions.get(application.id) === controller) {
        sessions.delete(application.id);
      }
    };

    const open = (): EventStream =>
      api.apps.realtime(application.id, { signal });

    // The request goes out on the first `next()`: a refusal
    // (REALTIME_MAX_CONNECTIONS, a stopped app...) throws here, before any
    // console opens, and the command reports it.
    let stream = open();
    let first: IteratorResult<RealtimeEvent, void>;
    try {
      first = await stream.next();
    } catch (error) {
      releaseSlot();
      throw error;
    }
    // Stopped (toggled) while the request was in flight: the SDK already
    // closed the connection on abort.
    if (signal.aborted) {
      releaseSlot();
      return;
    }

    const channel = getOutputChannel(
      extension.context.subscriptions,
      `realtime:${application.id}`,
      `Square Cloud Realtime (${application.name})`,
    );

    channel.show();
    channel.appendLine(`[${t("realtime.started")}]`);

    const print = (event: RealtimeEvent) => {
      const line = printableLine(event);
      if (line !== undefined) channel.appendLine(line);
    };

    // The global `sessions` map is drained on extension dispose via
    // `disposeAllRealtimeSessions()` from `core/deactivate.ts`. We deliberately
    // do NOT push a per-call disposable into `context.subscriptions` — repeated
    // start/stops were accumulating no-op entries that lived for the whole
    // extension lifetime.
    //
    // The SDK reconnects dropped connections itself; a clean close is the
    // server's ~10-minute TTL, so we open a new stream after a short delay and
    // the session survives it transparently.
    void (async () => {
      try {
        for (;;) {
          const startedAt = Date.now();
          try {
            if (!first.done) print(first.value);
            for await (const event of stream) print(event);
          } catch (error) {
            if (!signal.aborted) window.showErrorMessage(describeError(error));
            break;
          }
          if (signal.aborted) break;

          // A stream that died right away is a refusal (stopped/deleted app,
          // maintenance), not a TTL close — reconnecting would loop hard.
          if (Date.now() - startedAt < MIN_HEALTHY_STREAM_MS) {
            window.showErrorMessage(t("realtime.startError"));
            break;
          }

          channel.appendLine(`[${t("realtime.reconnecting")}]`);
          await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
          if (signal.aborted) break;

          stream = open();
          first = { done: true, value: undefined };
        }
      } finally {
        releaseSlot();
        channel.appendLine(`[${t("realtime.ended")}]`);
      }
    })();
  },
);

/** Aborts every active realtime session. Called from extension dispose. */
export function disposeAllRealtimeSessions(): void {
  for (const controller of sessions.values()) controller.abort();
  sessions.clear();
}
