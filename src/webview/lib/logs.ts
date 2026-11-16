// Log lines from two sources that overlap: the history call and the live
// stream, which replays recent lines each time it (re)connects. No
// imports: `node --test` loads this file directly.

/** The history call's text as lines, without the empty one after the last. */
export function splitLogs(text: string): string[] {
  if (!text) return [];
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

/**
 * `incoming` after `buffer`, minus the lines both have. Looks in `incoming`
 * for the buffer's last line (and the two before it, where both have them)
 * and keeps what comes after; with no match, all of it. Only for the
 * first batch of a connection and for the history: a later batch is all
 * new, and a repeated line in it is a real one.
 */
export function mergeLogs<T>(
  buffer: readonly T[],
  incoming: readonly T[],
  text: (line: T) => string,
): T[] {
  const n = buffer.length;
  const last = n ? text(buffer[n - 1] as T) : undefined;
  for (let j = incoming.length - 1; j >= 0 && last !== undefined; j--) {
    if (text(incoming[j] as T) !== last) continue;
    let same = true;
    for (let k = 1; k < 3 && j - k >= 0 && n - 1 - k >= 0; k++)
      if (text(incoming[j - k] as T) !== text(buffer[n - 1 - k] as T)) {
        same = false;
        break;
      }
    if (same) return [...buffer, ...incoming.slice(j + 1)];
  }
  return [...buffer, ...incoming];
}

/** The newest `max` lines. */
export const capLines = <T>(lines: T[], max: number): T[] =>
  lines.length > max ? lines.slice(-max) : lines;
