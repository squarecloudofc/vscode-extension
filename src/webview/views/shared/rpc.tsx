import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { Alert, Button, IconButton } from "../../components";
import { t } from "../../l10n";
import { call, isSignedOut, needsReconnect, RpcError } from "../../rpc";

// What every panel tab needs around its RPC calls: a load with its error,
// one action's inline feedback, and the way a failure reads (a key without
// the scope offers "Reconnect", never the raw error).

export type Load<T> = {
  data?: T;
  error?: unknown;
  loading: boolean;
  reload(): void;
  /** Replaces the data (a write answered the new list). */
  set(data: T): void;
};

/** Calls `method` on mount, and again on `reload()` or when `key` changes. */
export function useRpc<T>(method: string, params?: unknown, key = ""): Load<T> {
  const [state, setState] = useState<{ data?: T; error?: unknown }>({});
  const [loading, setLoading] = useState(true);
  const [round, setRound] = useState(0);
  const latest = useRef(0);

  // `key` stands for `params`, which is a new object on every render.
  useEffect(() => {
    const ticket = ++latest.current;
    setLoading(true);
    call<T>(method, params).then(
      (data) => {
        if (ticket !== latest.current) return;
        setState({ data });
        setLoading(false);
      },
      (error: unknown) => {
        if (ticket !== latest.current) return;
        // A failed reload keeps what was on screen next to its error.
        setState((previous) => ({ data: previous.data, error }));
        setLoading(false);
      },
    );
  }, [method, key, round]);

  return {
    ...state,
    loading,
    reload: useCallback(() => setRound((n) => n + 1), []),
    set: useCallback((data: T) => setState({ data }), []),
  };
}

export type Task = {
  busy: boolean;
  /** Just finished well: for a moment, the button says so. */
  done: boolean;
  error?: unknown;
  run<T>(work: () => Promise<T>): Promise<T | undefined>;
  clear(): void;
};

/**
 * One action's feedback in place, never a notification: busy while it
 * runs, then "done" for two seconds, or its error until the next try.
 */
export function useTask(): Task {
  const [state, setState] = useState<{
    busy: boolean;
    done: boolean;
    error?: unknown;
  }>({ busy: false, done: false });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const run = useCallback(async <T,>(work: () => Promise<T>) => {
    clearTimeout(timer.current);
    setState({ busy: true, done: false });
    try {
      const result = await work();
      setState({ busy: false, done: true });
      timer.current = setTimeout(
        () => setState({ busy: false, done: false }),
        2000,
      );
      return result;
    } catch (error) {
      setState({ busy: false, done: false, error });
      return undefined;
    }
  }, []);

  return {
    ...state,
    run,
    clear: useCallback(() => setState({ busy: false, done: false }), []),
  };
}

/** A dialog closed without a choice: a task's result, never reported. */
export class Canceled extends Error {}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : t("panel.error.body");

/**
 * How a failure reads. Signed out gets "Connect account"; a key from
 * before 6.0 without the scope gets "Reconnect"; a rate limit (429) a calm note to wait; anything else its
 * message (already in words, from the host), with "Try again" when the
 * caller can retry.
 */
export function Failure({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  /** A heading over the message, for a load that failed. */
  title?: string;
}) {
  if (error instanceof Canceled) return null;
  // Signed out: a calm way back; sign-in opens only from this button.
  if (isSignedOut(error))
    return (
      <Alert
        action={
          <Button
            onClick={() => void call("reconnect")}
            size="xs"
            variant="secondary"
          >
            {t("command.setApiKey")}
          </Button>
        }
        intent="warning"
        title={t("sidebar.signIn.title")}
      />
    );
  if (needsReconnect(error))
    return (
      <Alert
        action={
          <Button
            onClick={() => void call("reconnect")}
            size="xs"
            variant="secondary"
          >
            {t("panel.reconnect.action")}
          </Button>
        }
        intent="warning"
        title={t("panel.reconnect.title")}
      >
        {t("panel.reconnect.body")}
      </Alert>
    );
  const retry = onRetry ? (
    <Button onClick={onRetry} size="xs" variant="secondary">
      {t("panel.retry")}
    </Button>
  ) : undefined;
  if (error instanceof RpcError && error.status === 429)
    return (
      <Alert
        action={retry}
        icon="clock-counter-clockwise"
        intent="warning"
        title={t("problem.rateLimit.title")}
      >
        {messageOf(error)}
      </Alert>
    );
  return (
    <Alert action={retry} intent="danger" title={title ?? messageOf(error)}>
      {title ? messageOf(error) : undefined}
    </Alert>
  );
}

/**
 * A value with a copy button that says it copied (the host's `copy`).
 * `line`: on one line, cut with an ellipsis, the whole value as its tooltip.
 */
export function Copyable({
  text,
  label,
  line,
}: {
  text: string;
  label: string;
  line?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <span class={line ? "copyable copyable--line" : "copyable"}>
      <span class="mono copyable__text" title={line ? text : undefined}>
        {text}
      </span>
      <IconButton
        icon={copied ? "check" : "copy"}
        label={copied ? t("app.copied") : label}
        onClick={() =>
          void call("copy", { text }).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
        }
      />
    </span>
  );
}
