import { useEffect, useRef, useState } from "preact/hooks";

import type { LogBatch, StreamState } from "../../protocol";
import {
  Button,
  Console,
  type ConsoleLine,
  IconButton,
  Input,
  StatusDot,
} from "../../components";
import { locale, t } from "../../l10n";
import { matchesLog, plainText } from "../../lib/ansi";
import { formatTime } from "../../lib/format";
import { capLines, mergeLogs, splitLogs } from "../../lib/logs";
import { call, onHostMessage } from "../../rpc";
import { Canceled, Failure, type Load, useRpc, useTask } from "../shared/rpc";

/** What the panel keeps; older lines scroll away. */
const MAX_LINES = 5000;

let nextId = 0;
const textOf = (line: ConsoleLine) => line.text;

export type Logs = {
  lines: ConsoleLine[];
  /** Lines that arrived while paused, shown on resume. */
  held: number;
  paused: boolean;
  pause(): void;
  resume(): void;
  clear(): void;
  history: Load<string>;
};

/**
 * The app's log lines: the history call, then each live batch the host
 * sends (`logs` events). The panel's root keeps them, so the Overview's
 * preview and the Logs tab read the same lines and a tab switch keeps them.
 */
export function useLogs(): Logs {
  const history = useRpc<string>("logs");
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(0);
  const pausedRef = useRef(false);
  const heldRef = useRef<{ lines: ConsoleLine[]; replay: boolean }>({
    lines: [],
    replay: false,
  });

  // A history read (first, or Reload) goes before the live lines it overlaps.
  useEffect(() => {
    if (history.data === undefined) return;
    const base = splitLogs(history.data).map((text) => ({
      id: nextId++,
      text,
    }));
    setLines((live) => capLines(mergeLogs(base, live, textOf), MAX_LINES));
  }, [history.data]);

  useEffect(
    () =>
      onHostMessage((message) => {
        if (message.type !== "event" || message.name !== "logs") return;
        const batch = message.data as LogBatch;
        const add = batch.lines.map((line) => ({
          id: nextId++,
          text: line.text,
          stderr: line.stderr,
          time: formatTime(line.at, locale(), true),
        }));
        if (pausedRef.current) {
          const h = heldRef.current;
          heldRef.current = {
            lines: capLines([...h.lines, ...add], MAX_LINES),
            replay: h.replay || batch.replay,
          };
          setHeld(heldRef.current.lines.length);
          return;
        }
        setLines((l) =>
          capLines(
            batch.replay ? mergeLogs(l, add, textOf) : [...l, ...add],
            MAX_LINES,
          ),
        );
      }),
    [],
  );

  return {
    lines,
    held,
    paused,
    pause() {
      pausedRef.current = true;
      setPaused(true);
    },
    resume() {
      const h = heldRef.current;
      heldRef.current = { lines: [], replay: false };
      pausedRef.current = false;
      setPaused(false);
      setHeld(0);
      setLines((l) =>
        capLines(
          h.replay ? mergeLogs(l, h.lines, textOf) : [...l, ...h.lines],
          MAX_LINES,
        ),
      );
    },
    clear() {
      heldRef.current = { lines: [], replay: false };
      setHeld(0);
      setLines([]);
    },
    history,
  };
}

/** The stream in a word, and why it's off when that helps. */
export function StreamStatus({
  stream,
  running,
}: {
  stream?: StreamState;
  running?: boolean;
}) {
  if (stream?.state === "live")
    return <StatusDot label={t("app.live.on")} pulse={false} tone="green" />;
  if (stream?.state === "connecting")
    return <StatusDot label={t("app.live.connecting")} tone="amber" />;
  const why =
    stream?.code === "REALTIME_MAX_CONNECTIONS"
      ? t("app.live.limit")
      : running === false
        ? t("app.live.stopped")
        : undefined;
  return (
    <span class="row row--tight">
      <StatusDot label={t("app.live.off")} tone="muted" />
      {why ? <span class="muted stream-why">· {why}</span> : null}
    </span>
  );
}

export function LogsTab({
  logs,
  stream,
  running,
}: {
  logs: Logs;
  stream?: StreamState;
  running?: boolean;
}) {
  const [query, setQuery] = useState("");
  const save = useTask();
  const shown = query.trim()
    ? logs.lines.filter((line) => matchesLog(line.text, query))
    : logs.lines;

  return (
    <section class="stack logs">
      <div class="logs__bar">
        <Input
          aria-label={t("app.logs.search")}
          class="logs__search"
          icon="magnifying-glass"
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder={t("app.logs.search")}
          spellcheck={false}
          type="search"
          value={query}
        />
        <div class="logs__state">
          {logs.paused ? (
            <StatusDot
              label={
                logs.held
                  ? t("app.logs.pausedHeld", { COUNT: logs.held })
                  : t("app.logs.paused")
              }
              pulse={false}
              tone="amber"
            />
          ) : (
            <StreamStatus running={running} stream={stream} />
          )}
        </div>
        <div class="row row--tight">
          <Button
            icon={logs.paused ? "play" : "pause"}
            onClick={logs.paused ? logs.resume : logs.pause}
            size="xs"
            variant="ghost"
          >
            {logs.paused ? t("app.logs.resume") : t("app.logs.pause")}
          </Button>
          <IconButton
            busy={logs.history.loading}
            icon="arrow-clockwise"
            label={t("app.logs.reload")}
            onClick={logs.history.reload}
          />
          <IconButton
            disabled={!logs.lines.length}
            icon="broom"
            label={t("app.logs.clear")}
            onClick={logs.clear}
          />
          <IconButton
            busy={save.busy}
            disabled={!logs.lines.length}
            icon={save.done ? "check" : "download-simple"}
            label={save.done ? t("app.logs.saved") : t("app.logs.download")}
            onClick={() =>
              void save.run(async () => {
                const text = shown
                  .map((line) => plainText(line.text))
                  .join("\n");
                const saved = await call<boolean>("logs.save", { text });
                if (!saved) throw new Canceled();
              })
            }
          />
        </div>
      </div>
      {logs.history.error ? (
        <Failure error={logs.history.error} onRetry={logs.history.reload} />
      ) : null}
      {save.error ? <Failure error={save.error} /> : null}
      <Console
        class="logs__console"
        empty={
          query.trim()
            ? t("app.logs.noMatch", { QUERY: query.trim() })
            : logs.history.loading
              ? t("generic.loading")
              : t("app.logs.empty")
        }
        height="calc(100vh - 230px)"
        label={t("app.logs.label")}
        lines={shown}
      />
    </section>
  );
}
