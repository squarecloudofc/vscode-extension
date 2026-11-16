// Many writes under a per-user rate limit, one at a time. No imports:
// `node --test` loads this file.

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export type PaceOptions = {
  /** At least this long between two starts. */
  gapMs: number;
  /** A refusal `busy` recognises waits this long, then the same item goes again. */
  retryMs?: number;
  /** How many times one item may be refused before it all stops. */
  retries?: number;
  busy?: (error: unknown) => boolean;
  wait?: (ms: number) => Promise<void>;
};

/**
 * A queue for writes that may come from anywhere at once (Save All, a
 * pasted folder): each call runs after the one before has finished, its
 * start spaced `gapMs` from the last. A refusal that only says "too fast"
 * (`busy`) waits and tries the same work again; any other failure rejects
 * that call alone, and the queue goes on.
 */
export function pacer({
  gapMs,
  retryMs = 5_000,
  retries = 3,
  busy = () => false,
  wait = sleep,
}: PaceOptions): <R>(work: () => Promise<R>) => Promise<R> {
  let last = Number.NEGATIVE_INFINITY;
  let queue: Promise<unknown> = Promise.resolve();
  return (work) => {
    const run = queue.then(async () => {
      for (let attempt = 0; ; attempt++) {
        const ahead = last + gapMs - Date.now();
        if (ahead > 0) await wait(ahead);
        last = Date.now();
        try {
          return await work();
        } catch (error) {
          if (!busy(error) || attempt >= retries) throw error;
          await wait(retryMs);
        }
      }
    });
    queue = run.catch(() => undefined);
    return run;
  };
}

/**
 * Runs `work` on each item in order through one `pacer`. The first failure
 * stops the rest. Says how many went through, and what stopped the rest.
 */
export async function paced<T>(
  items: readonly T[],
  work: (item: T) => Promise<unknown>,
  options: PaceOptions,
): Promise<{ done: number; error?: unknown }> {
  const run = pacer(options);
  for (const [done, item] of items.entries()) {
    try {
      await run(() => work(item));
    } catch (error) {
      return { done, error };
    }
  }
  return { done: items.length };
}
