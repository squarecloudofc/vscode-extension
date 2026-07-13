import { SquareCloudAPIError } from "@squarecloud/api";
import { type OutputChannel, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { getOutputChannel } from "@/lib/utils/output-channels";
import { ApplicationCommand } from "@/structures/application/command";

/** The API allows at most 5 concurrent SSE connections per user. */
const MAX_SESSIONS = 5;
/** Short backoff before reconnecting after the server-side TTL closes the stream. */
const RECONNECT_DELAY_MS = 3_000;

const sessions = new Map<string, AbortController>();

function appendSseChunk(channel: OutputChannel, chunk: string) {
  // SSE events are separated by blank lines. Each line starting with `data: `
  // carries the payload; strip the prefix and log the rest verbatim.
  for (const block of chunk.split(/\r?\n\r?\n/)) {
    const dataLines = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trimStart());
    if (dataLines.length === 0) continue;
    channel.appendLine(dataLines.join("\n"));
  }
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

    if (sessions.size >= MAX_SESSIONS) {
      window.showErrorMessage(t("realtime.maxSessions"));
      return;
    }

    const response = await application.realtime();
    if (!response.body) {
      window.showErrorMessage(t("realtime.startError"));
      return;
    }

    const channel = getOutputChannel(
      extension.context.subscriptions,
      `realtime:${application.id}`,
      `Square Cloud Realtime (${application.name})`,
    );

    const controller = new AbortController();
    sessions.set(application.id, controller);

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
      let body: ReadableStream<Uint8Array> | null = response.body;
      try {
        while (!controller.signal.aborted) {
          if (!body) break;
          await pumpStream(body, channel, controller.signal).catch(() => {});
          body = null;
          if (controller.signal.aborted) break;

          channel.appendLine(`[${t("realtime.reconnecting")}]`);
          await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));
          if (controller.signal.aborted) break;

          try {
            body = (await application.realtime()).body;
          } catch (error) {
            // Connection cap reached (or any other API refusal) — stop instead
            // of hammering the endpoint in a retry loop.
            if (error instanceof SquareCloudAPIError) {
              window.showErrorMessage(
                error.code === "REALTIME_MAX_CONNECTIONS"
                  ? t("realtime.maxSessions")
                  : t("realtime.startError"),
              );
            }
            break;
          }
        }
      } finally {
        sessions.delete(application.id);
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
