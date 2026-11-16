// The pure half of <Chart> and <Sparkline>: y scale, ticks and SVG paths,
// ported from the site (packages/ui data-display/chart-parts.tsx). No
// imports: `node --test` loads this file directly.

export const round = (v: number) => Math.round(v * 10) / 10;

/** 0-based ticks on a 1/2/5 step, the last one at or above `max`. */
export function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  const out: number[] = [];
  for (let k = 0; ; k++) {
    const v = Number((k * step).toPrecision(12));
    out.push(v);
    if (v >= max) return out;
  }
}

/**
 * `niceTicks` for bytes: the 1/2/5 step in the unit the largest value is
 * shown in (512 MB → 0, 200, 400, 600 MB), returned in bytes.
 */
export function niceByteTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const unit = 1024 ** Math.floor(Math.log(max) / Math.log(1024));
  return niceTicks(max / unit).map((v) => v * unit);
}

/**
 * Pixel y of `value` on an axis from 0 to `top`, `height` px tall (0 at the
 * bottom edge, so y grows downward). Clamped to the axis.
 */
export function yAt(value: number, top: number, height: number): number {
  if (!(top > 0)) return height;
  const v = Math.min(Math.max(value, 0), top);
  return round(height - (v / top) * height);
}

type Point = readonly [number, number];

/**
 * SVG path through the points: straight, or monotone cubic (d3's
 * curveMonotoneX: it never overshoots a sample, so a peak stays a peak).
 */
export function linePath(p: readonly Point[], monotone = false): string {
  if (!p.length) return "";
  const at = (j: number): Point => p[j] ?? [0, 0];
  const head = `M${at(0)[0]},${at(0)[1]}`;
  if (!monotone || p.length < 3)
    return (
      head +
      p
        .slice(1)
        .map(([x, y]) => `L${x},${y}`)
        .join("")
    );
  // Two samples at the same x have no slope: 0, never Infinity × 0 = NaN
  // (the browser drops a path from its first NaN on).
  const s = p.slice(1).map((q, j) => {
    const dx = q[0] - at(j)[0];
    return dx ? (q[1] - at(j)[1]) / dx || 0 : 0;
  });
  const t: number[] = [];
  for (let j = 1; j < p.length - 1; j++) {
    const s0 = s[j - 1] ?? 0;
    const s1 = s[j] ?? 0;
    const h0 = at(j)[0] - at(j - 1)[0];
    const h1 = at(j + 1)[0] - at(j)[0];
    const q = h0 + h1 ? (s0 * h1 + s1 * h0) / (h0 + h1) : 0;
    t[j] =
      (Math.sign(s0) + Math.sign(s1)) *
        Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(q)) || 0;
  }
  const last = p.length - 1;
  t[0] = (3 * (s[0] ?? 0) - (t[1] ?? 0)) / 2;
  t[last] = (3 * (s[last - 1] ?? 0) - (t[last - 1] ?? 0)) / 2;
  let out = head;
  for (let j = 1; j < p.length; j++) {
    const [ax, ay] = at(j - 1);
    const [bx, by] = at(j);
    const dx = (bx - ax) / 3;
    out += `C${round(ax + dx)},${round(ay + dx * (t[j - 1] ?? 0))},${round(bx - dx)},${round(by - dx * (t[j] ?? 0))},${bx},${by}`;
  }
  return out;
}
