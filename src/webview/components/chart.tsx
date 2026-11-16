import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { linePath, niceTicks, round, yAt } from "../lib/chart";
import { cx } from "../lib/cx";

// Hand-drawn SVG charts like the site's (packages/ui data-display/chart.tsx):
// y from 0 on a 1/2/5 step, dashed `2 4` grid, crosshair and a tooltip with
// a swatch per series, drawn in from the left once (700 ms).

export type ChartSeries = {
  key: string;
  name: string;
  /** Any CSS colour, usually a token: `var(--sq-chart-1)`. */
  color: string;
};

export type ChartRow = Record<string, number | null | undefined>;

const MARGIN = { top: 8, right: 4, bottom: 22 };

export function Chart({
  data,
  x,
  series,
  type = "area",
  height = 200,
  yWidth = 48,
  xFormat = String,
  yFormat = String,
  valueFormat = yFormat,
  ticks = niceTicks,
  label,
}: {
  /** Rows in x order; a missing or null value is no sample, never 0. */
  data: readonly ChartRow[];
  /** The x column: epoch ms (placed by value). */
  x: string;
  series: readonly ChartSeries[];
  type?: "area" | "line";
  height?: number;
  /** Room for the y labels; 0 hides the axis. */
  yWidth?: number;
  xFormat?: (value: number) => string;
  yFormat?: (value: number) => string;
  /** The tooltip's values, often finer than the axis. Default yFormat. */
  valueFormat?: (value: number) => string;
  /** The y ticks for the largest value (niceByteTicks for bytes). */
  ticks?: (max: number) => number[];
  /** What the chart shows, for screen readers. */
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = data.length;
  const pw = Math.max(width - yWidth - MARGIN.right, 0);
  const ph = Math.max(height - MARGIN.top - MARGIN.bottom, 0);
  const xs = data.map((row) => row[x] ?? 0);
  const x0 = xs[0] ?? 0;
  const span = (xs[n - 1] ?? 0) - x0;
  const xAt = (i: number) =>
    round(
      span > 0
        ? (((xs[i] ?? 0) - x0) / span) * pw
        : n > 1
          ? (i / (n - 1)) * pw
          : pw / 2,
    );

  let max = 0;
  for (const row of data)
    for (const s of series) {
      const v = row[s.key];
      if (typeof v === "number" && v > max) max = v;
    }
  const yTicks = ticks(max);
  const top = yTicks.at(-1) ?? 1;
  const y = (v: number) => yAt(v, top, ph);

  // Room per x label from the longest end label (10 px mono, ~6.2 px a
  // glyph), half again because the end labels hang inward: "Nov 8, 12:00 PM"
  // needs more than "12:00 PM".
  const glyphs = Math.max(xFormat(x0).length, xFormat(x0 + span).length);
  const room = Math.max(96, glyphs * 9.3 + 16);
  const count = Math.max(2, Math.min(n, Math.floor(pw / room) + 1));
  const xTicks = n
    ? Array.from({ length: count }, (_, k) => {
        const f = k / (count - 1);
        return { pos: round(f * pw), value: x0 + f * span, f };
      })
    : [];

  const pick = (event: JSX.TargetedPointerEvent<SVGSVGElement>) => {
    if (!n) return;
    const px =
      event.clientX - event.currentTarget.getBoundingClientRect().left - yWidth;
    let at = 0;
    for (let j = 1; j < n; j++)
      if (Math.abs(xAt(j) - px) < Math.abs(xAt(at) - px)) at = j;
    setActive(at);
  };

  const i = active !== null && active < n ? active : null;

  return (
    <figure
      aria-label={label}
      class="chart"
      onBlur={() => setActive(null)}
      onKeyDown={(event) => {
        const step =
          event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (event.key === "Escape") setActive(null);
        if (!step || !n) return;
        event.preventDefault();
        setActive(
          Math.min(n - 1, Math.max(0, (active ?? (step > 0 ? -1 : n)) + step)),
        );
      }}
      ref={ref}
      style={{ height: `${height}px` }}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: arrow keys step through the samples
      tabIndex={0}
    >
      {pw > 0 && ph > 0 ? (
        <svg
          aria-hidden="true"
          height={height}
          onPointerLeave={() => setActive(null)}
          onPointerMove={pick}
          width={width}
        >
          {yWidth
            ? yTicks.map((v) => (
                <text
                  dominant-baseline="middle"
                  font-size={10}
                  key={v}
                  text-anchor="end"
                  x={yWidth - 8}
                  y={MARGIN.top + y(v)}
                >
                  {yFormat(v)}
                </text>
              ))
            : null}
          <g transform={`translate(${yWidth} ${MARGIN.top})`}>
            {yTicks.slice(1).map((v) => (
              <line class="chart__grid" key={v} x2={pw} y1={y(v)} y2={y(v)} />
            ))}
            <line class="chart__base" x2={pw} y1={ph} y2={ph} />
            {xTicks.map((t) => (
              <text
                font-size={10}
                key={t.pos}
                text-anchor={t.f === 0 ? "start" : t.f === 1 ? "end" : "middle"}
                x={t.pos}
                y={ph + 16}
              >
                {xFormat(t.value)}
              </text>
            ))}
            {i !== null ? (
              <line class="chart__cursor" x1={xAt(i)} x2={xAt(i)} y2={ph} />
            ) : null}
            <g class="chart__plot">
              {series.map((s) => {
                const points = data.flatMap((row, j) => {
                  const v = row[s.key];
                  return typeof v === "number" ? [[xAt(j), y(v)] as const] : [];
                });
                if (!points.length) return null;
                const d = linePath(points, true);
                const first = points[0]?.[0] ?? 0;
                const last = points.at(-1)?.[0] ?? 0;
                return (
                  <g key={s.key}>
                    {type === "area" ? (
                      <path
                        d={`${d}L${last},${ph}L${first},${ph}Z`}
                        fill-opacity={0.16}
                        style={{ fill: s.color }}
                      />
                    ) : null}
                    <path
                      d={d}
                      fill="none"
                      stroke-linejoin="round"
                      stroke-width={2}
                      style={{ stroke: s.color }}
                    />
                  </g>
                );
              })}
            </g>
            {i !== null
              ? series.map((s) => {
                  const v = data[i]?.[s.key];
                  return typeof v === "number" ? (
                    <circle
                      class="chart__dot"
                      cx={xAt(i)}
                      cy={y(v)}
                      key={s.key}
                      r={4}
                      style={{ fill: s.color }}
                    />
                  ) : null;
                })
              : null}
          </g>
        </svg>
      ) : null}
      {i !== null && data[i] ? (
        <div
          class="chart__tip"
          style={{
            top: `${MARGIN.top}px`,
            left: `${yWidth + xAt(i) + (xAt(i) > pw / 2 ? -12 : 12)}px`,
            transform: xAt(i) > pw / 2 ? "translateX(-100%)" : undefined,
          }}
        >
          <span class="chart__tip-title">{xFormat(xs[i] ?? 0)}</span>
          {series.map((s) => {
            const v = data[i]?.[s.key];
            return (
              <span class="chart__tip-row" key={s.key}>
                <span class="chart__swatch" style={{ background: s.color }} />
                {s.name}
                <span class="chart__tip-value">
                  {typeof v === "number" ? valueFormat(v) : "—"}
                </span>
              </span>
            );
          })}
        </div>
      ) : null}
    </figure>
  );
}

/** A small trend (a stat cell's): line plus a faint area, no axes. */
export function Sparkline({
  data,
  max,
  floor = 0,
  color = "var(--sq-blue)",
}: {
  data: readonly number[];
  /** Fixed ceiling (100 for a percentage); default the window's peak. */
  max?: number;
  /** Lowest ceiling, so idle noise isn't blown up into spikes. */
  floor?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const peak = max ?? Math.max(floor, ...data);
  const points = data.map(
    (v, i) => [round((i / (data.length - 1)) * 100), yAt(v, peak, 32)] as const,
  );
  const d = linePath(points, true);
  return (
    <svg
      aria-hidden="true"
      class="sparkline"
      preserveAspectRatio="none"
      viewBox="0 0 100 32"
    >
      <path
        d={`${d}L100,32L0,32Z`}
        fill-opacity={0.12}
        style={{ fill: color }}
      />
      <path
        d={d}
        fill="none"
        stroke-width={1.5}
        style={{ stroke: color }}
        vector-effect="non-scaling-stroke"
      />
    </svg>
  );
}

/** 0 normal, 1 nearing the limit (80 %), 2 at it (95 %). */
export const usageLevel = (percent: number) =>
  percent >= 95 ? 2 : percent >= 80 ? 1 : 0;

/**
 * How full a limit is: blue, amber from 80 %, red from 95 %. A live but
 * tiny share keeps 3 px; a true 0 reads empty. Hidden from screen readers:
 * the number next to it says the same.
 */
export function UsageBar({
  percent,
  class: className,
}: {
  percent: number;
  class?: string;
}) {
  const p = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const level = usageLevel(p);
  return (
    <div aria-hidden="true" class={cx("usage", className)}>
      <div
        class={cx(
          "usage__fill",
          level === 1 && "usage__fill--near",
          level === 2 && "usage__fill--full",
        )}
        style={{ width: p > 0 ? `max(3px, ${p}%)` : "0" }}
      />
    </div>
  );
}
