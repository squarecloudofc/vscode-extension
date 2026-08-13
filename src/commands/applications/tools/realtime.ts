import { type BaseApplication, SquareCloudAPIError } from "@squarecloud/api";
import { type OutputChannel, window } from "vscode";
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

/**
 * Opens the SSE stream. The SDK's `realtime()` is a raw `fetch` that resolves
 * on HTTP errors too, so we check `ok` ourselves and surface the API error
 * code (e.g. REALTIME_MAX_CONNECTIONS) through the shared error map.
 */
async function openStream(
  application: BaseApplication,
): Promise<ReadableStream<Uint8Array>> {
  const response = await application.realtime();
  if (!response.ok) {
    const code = await response
      .json()
      .then((data) => data?.code)
      .catch(() => undefined);
    throw new SquareCloudAPIError(code ?? `UNKNOWN_ERROR_${response.status}`);
  }
  if (!response.body) throw new SquareCloudAPIError("EMPTY_RESPONSE");
  return response.body;
}

/**
 * Frames worth printing in a console. The stream also carries `status`
 * (cpu/ram/netIO, several times a second) and `system` protocol signals — the
 * former buries the output it is mixed into, and the latter is already
 * narrated by the markers this command writes itself.
 */
const PRINTED_EVENTS = new Set(["logs", "error"]);

/**
 * Pulls the printable lines out of a raw SSE chunk.
 *
 * Wire format is `event: <name>` followed by one or more `data:` lines, blocks
 * separated by a blank line. Log payloads carry a stream-id byte up front:
 * `\x01` for stdout, `\x02` for stderr.
 *
 * Exported for `scripts/check-realtime.mjs`.
 */
export function extractPrintableLines(chunk: string): string[] {
  const lines: string[] = [];

  for (const block of chunk.split(/\r?\n\r?\n/)) {
    const blockLines = block.split(/\r?\n/);

    const event = blockLines
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim();

    if (!event || !PRINTED_EVENTS.has(event)) continue;

    const data = blockLines
      .filter((line) => line.startsWith("data:"))
      // SSE strips exactly one leading space, not all of it — a log console
      // has to keep the indentation of stack traces.
      .map((line) => stripStreamId(line.slice(5).replace(/^ /, "")));

    if (data.length === 0) continue;
    lines.push(data.join("\n"));
  }

  return lines;
}

function stripStreamId(line: string): string {
  const first = line.charCodeAt(0);
  return first === 1 || first === 2 ? line.slice(1) : line;
}

function appendSseChunk(channel: OutputChannel, chunk: string) {
  for (const line of extractPrintableLines(chunk)) channel.appendLine(line);
}

/** Reads the SSE stream to completion. Resolves when the server closes it. */
async function pumpStream(
  body: ReadableStream<Uint8Array>,
  channel: OutputChannel,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const onAbort = () => void reader.cancel().catch(() => {});
  signal.addEventListener("abort", onAbort);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const splitAt = buffer.lastIndexOf("\n\n");
      if (splitAt !== -1) {
        appendSseChunk(channel, buffer.slice(0, splitAt));
        buffer = buffer.slice(splitAt + 2);
      }
    }
    if (buffer) appendSseChunk(channel, buffer);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export const realtimeEntry = new ApplicationCommand(
  "realtimeEntry",
  async (extension, { application }) => {
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
    sessions.set(application.id, controller);
    // The map entry may already belong to a newer session by the time this
    // runs (toggle-stop deletes eagerly) — only remove what we own.
    const releaseSlot = () => {
      if (sessions.get(application.id) === controller) {
        sessions.delete(application.id);
      }
    };

    let initialBody: ReadableStream<Uint8Array>;
    try {
      initialBody = await openStream(application);
    } catch (error) {
      releaseSlot();
      throw error;
    }
    if (controller.signal.aborted) {
      // Stopped (toggled) while the fetch was in flight — don't leak the
      // freshly opened connection.
      void initialBody.cancel().catch(() => {});
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

    // The global `sessions` map is drained on extension dispose via
    // `disposeAllRealtimeSessions()` from `core/deactivate.ts`. We deliberately
    // do NOT push a per-call disposable into `context.subscriptions` — repeated
    // start/stops were accumulating no-op entries that lived for the whole
    // extension lifetime.
    //
    // Server-side each connection lives ~10 minutes; when the stream closes
    // without a user abort we reconnect after a short delay so the session
    // survives the TTL transparently.
    void (async () => {
      let body: ReadableStream<Uint8Array> | null = initialBody;
      try {
        while (body) {
          const startedAt = Date.now();
          await pumpStream(body, channel, controller.signal).catch(() => {});
          body = null;
          if (controller.signal.aborted) break;

          // A stream that died right away is a refusal (stopped/deleted app,
          // maintenance), not a TTL close — reconnecting would loop hard.
          if (Date.now() - startedAt < MIN_HEALTHY_STREAM_MS) {
            window.showErrorMessage(t("realtime.startError"));
            break;
          }

          channel.appendLine(`[${t("realtime.reconnecting")}]`);
          await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
          if (controller.signal.aborted) break;

          try {
            body = await openStream(application);
          } catch (error) {
            window.showErrorMessage(describeError(error));
            break;
          }
          if (controller.signal.aborted) {
            // Stopped while the reconnect fetch was in flight — cancel the
            // fresh stream instead of abandoning a live server connection.
            void body.cancel().catch(() => {});
            break;
          }
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
