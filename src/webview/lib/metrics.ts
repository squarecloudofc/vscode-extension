// Chart rows from the API's metric points, ported from the site
// (dashboard/_components/metrics-derive.ts). The app and database panels
// both draw them. No imports: `node --test` loads this file directly.

/** A point as `metrics()` answers it (`MetricPoint` in the SDK). */
export type MetricPointLike = {
  date: string;
  /** % of the plan's CPU. */
  cpu: number;
  /** MB. */
  ram: number;
  /** `[received, sent]` bytes, cumulative since the container started. */
  net: number[];
  /** `[read, written]` bytes, cumulative like `net`. */
  disk?: number[] | null;
  /** Bytes on disk. */
  storage?: number | null;
  /** The hour's peaks, only on 7-day points. */
  cpu_max?: number;
  ram_max?: number;
};

export type MetricRow = { t: number } & Record<string, number | null>;

const MB = 1024 * 1024;

/** 7-day points always carry `cpu_max`; a 24-hour answer to a 7-day ask doesn't. */
export const isWeekly = (points: readonly { cpu_max?: number }[]) =>
  points[0]?.cpu_max !== undefined;

/**
 * What a cumulative counter moved between two samples. A counter that fell
 * means the container restarted: what it holds now is what moved since.
 */
export function counterDelta(cur: number, prev: number) {
  return cur >= prev
    ? { delta: cur - prev, restarted: false }
    : { delta: cur, restarted: true };
}

/**
 * Chart rows from the points (any order), oldest first:
 * - CPU in %, RAM in bytes, each with the hour's peak on 7-day points.
 * - Network as a rate (bytes/s) from the counters; the first point and the
 *   one right after a gap (over twice the usual step) have none.
 * - Disk I/O as bytes moved per step; a point without a reading is never
 *   the base of the next one.
 * - Storage as the level it reads.
 * Disk and storage come back empty when no point has a reading, so the
 * view can leave their charts out.
 */
export function deriveMetrics(points: readonly MetricPointLike[]) {
  const data = [...points].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date),
  );
  const ts = data.map((d) => Date.parse(d.date));
  const steps = ts
    .slice(1)
    .map((t, i) => t - (ts[i] ?? t))
    .filter((dt) => dt > 0)
    .sort((a, b) => a - b);
  const step = steps[Math.floor(steps.length / 2)] ?? 5 * 60 * 1000;
  const weekly = isWeekly(data);
  const restarts: number[] = [];
  const cpu: MetricRow[] = [];
  const ram: MetricRow[] = [];
  const net: MetricRow[] = [];
  const disk: MetricRow[] = [];
  const storage: MetricRow[] = [];
  // The axis starts at 0 and a share can't pass 100.
  const pct = (v: number) => Math.min(Math.max(v, 0), 100);

  data.forEach((d, i) => {
    const t = ts[i] ?? 0;
    cpu.push({ t, value: pct(d.cpu), max: pct(d.cpu_max ?? d.cpu) });
    ram.push({ t, value: d.ram * MB, max: (d.ram_max ?? d.ram) * MB });
    storage.push({ t, value: d.storage || null });

    const prev = data[i - 1];
    const dt = (t - (ts[i - 1] ?? t)) / 1000;
    if (!prev || dt <= 0 || dt * 1000 > step * 2) {
      net.push({ t, input: null, output: null });
      disk.push({ t, read: null, write: null });
      return;
    }
    let restarted = false;
    const moved = (cur = 0, before = 0) => {
      const c = counterDelta(cur, before);
      if (c.restarted) restarted = true;
      return c.delta;
    };
    net.push({
      t,
      input: moved(d.net[0], prev.net[0]) / dt,
      output: moved(d.net[1], prev.net[1]) / dt,
    });
    disk.push(
      d.disk && prev.disk
        ? {
            t,
            read: moved(d.disk[0], prev.disk[0]),
            write: moved(d.disk[1], prev.disk[1]),
          }
        : { t, read: null, write: null },
    );
    if (restarted) restarts.push(t);
  });

  return {
    cpu,
    ram,
    net,
    disk: disk.some((r) => r.read !== null) ? disk : [],
    storage: storage.some((r) => r.value !== null) ? storage : [],
    restarts,
    weekly,
  };
}
