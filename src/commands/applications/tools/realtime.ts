import { type OutputChannel, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { getOutputChannel } from "@/lib/utils/output-channels";
import { ApplicationCommand } from "@/structures/application/command";

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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    controller.signal.addEventListener("abort", () => {
      reader.cancel().catch(() => {});
    });

    // The global `sessions` map is drained on extension dispose via
    // `disposeAllRealtimeSessions()` from `core/deactivate.ts`. We deliberately
    // do NOT push a per-call disposable into `context.subscriptions` — repeated
    // start/stops were accumulating no-op entries that lived for the whole
    // extension lifetime.
    void (async () => {
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
      } catch {
        // Stream aborted or network error — surfaced via the `[ended]` line.
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
