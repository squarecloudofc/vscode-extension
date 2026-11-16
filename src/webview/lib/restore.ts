// Following a snapshot restore through `snapshots.restoreState()`, for the
// app and database panels. A restore can outlive its request (202, it keeps
// running), so the panel never says "restored" on the request alone: it
// reads the node's record until it ends. No imports: `node --test` loads
// this file directly.

/** `restoreState()`'s answer (`SnapshotRestoreState` in the SDK). Unix ms. */
export type RestoreAnswer = {
  state: "none" | "queued" | "running" | "success" | "error";
  step?: string;
  code?: string;
  started_at?: number;
  finished_at?: number;
};

/**
 * `waiting`: asked, nothing recorded yet. `unknown`: the node has no record
 * of how it ended.
 */
export type RestorePhase =
  | "waiting"
  | "running"
  | "success"
  | "error"
  | "unknown";

export type RestoreFollow = {
  /** When the restore was asked for (0 when joining one already running). */
  since: number;
  /** The restore request has answered. */
  posted: boolean;
  phase: RestorePhase;
  step?: string;
  code?: string;
};

/** How often `restoreState()` is read (its limit is 30 a minute). */
export const RESTORE_POLL_MS = 5000;

/** Clock difference allowed between this machine and the node. */
const SKEW_MS = 60_000;

export const isFinal = (phase: RestorePhase) =>
  phase === "success" || phase === "error" || phase === "unknown";

/** A restore just asked for. */
export const startRestore = (since: number): RestoreFollow => ({
  since,
  posted: false,
  phase: "waiting",
});

/** One already running (opened mid-restore, or a 409 RESTORE_IN_PROGRESS). */
export const joinRestore = (): RestoreFollow => ({
  since: 0,
  posted: true,
  phase: "running",
});

/** The request answered: finished (200), or still running (202, pending). */
export function settleRestore(
  follow: RestoreFollow,
  pending: boolean,
): RestoreFollow {
  if (isFinal(follow.phase)) return follow;
  return pending
    ? { ...follow, posted: true }
    : { ...follow, posted: true, phase: "success", step: undefined };
}

/**
 * Folds one `restoreState()` answer in. A success or error that started
 * before the click is an earlier restore (they stay for an hour) and isn't
 * this one's result. Once the request has answered, no record of the run
 * means its result is unknown.
 */
export function nextRestore(
  follow: RestoreFollow,
  answer: RestoreAnswer,
): RestoreFollow {
  if (isFinal(follow.phase)) return follow;
  if (answer.state === "queued" || answer.state === "running")
    return {
      ...follow,
      phase: "running",
      step: answer.state === "queued" ? "queued" : answer.step,
    };
  const at = answer.started_at ?? answer.finished_at ?? 0;
  if (
    (answer.state === "success" || answer.state === "error") &&
    at >= follow.since - SKEW_MS
  )
    return {
      ...follow,
      phase: answer.state,
      step: undefined,
      code: answer.code,
    };
  return follow.posted
    ? { ...follow, phase: "unknown", step: undefined }
    : follow;
}
