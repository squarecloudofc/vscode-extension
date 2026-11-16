import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";

import {
  Chart,
  type ChartSeries,
  EmptyState,
  IconButton,
  Skeleton,
  Tabs,
} from "../../components";
import { Icon } from "../../components/icon";
import { NAV_ICON } from "../../icons";
import { locale, t } from "../../l10n";
import { niceByteTicks } from "../../lib/chart";
import {
  formatBytes,
  formatDateTime,
  formatPercent,
  formatTime,
} from "../../lib/format";
import { deriveMetrics, type MetricPointLike } from "../../lib/metrics";
import { Failure, useRpc } from "./rpc";

// The Metrics tab of the app panel, and of the database panel (E5): both
// hosts answer `metrics` with the same points (src/panels/resource.ts).

/** Whether 7 days can be asked for (`AppInfo.week`). */
export type WeekAccess = "on" | "plan" | "small";

type Range = "24h" | "7d";

const C1 = "var(--sq-chart-1)";
const C2 = "var(--sq-chart-2)";
const C4 = "var(--sq-chart-4)";

export function MetricsPanel({ week }: { week: WeekAccess }) {
  const lang = locale();
  const [range, setRange] = useState<Range>("24h");
  const load = useRpc<MetricPointLike[]>("metrics", { range }, range);
  const rows = useMemo(
    () => (load.data ? deriveMetrics(load.data) : undefined),
    [load.data],
  );
  // When the answer on screen arrived.
  const updated = useMemo(
    () => (load.data ? Date.now() : undefined),
    [load.data],
  );

  const locked =
    week === "plan"
      ? t("panel.metrics.weekPlan")
      : week === "small"
        ? t("panel.metrics.weekSmall")
        : undefined;
  // Asked for 7 days, got 24 hours (another plan, a workspace's app): say so.
  const served =
    range === "7d" && !load.loading && rows?.cpu.length && !rows.weekly;
  const weekly = Boolean(rows?.weekly);
  const x = (v: number) =>
    weekly ? formatDateTime(v, lang) : formatTime(v, lang);
  const bytes = (v: number) => formatBytes(v, lang, 1);
  const rate = (v: number) => `${formatBytes(v, lang, 1)}/s`;
  // One decimal: 1.5 kB and 2 kB are different ticks.
  const axis = (v: number) => formatBytes(v, lang, 1);
  const pair = (a: string, b: string): ChartSeries[] => [
    { key: "value", name: a, color: C1 },
    { key: "max", name: b, color: C4 },
  ];

  const peak = weekly
    ? pair(t("panel.metrics.average"), t("panel.metrics.peak"))
    : undefined;
  const net: ChartSeries[] = [
    { key: "input", name: t("panel.metrics.inbound"), color: C1 },
    { key: "output", name: t("panel.metrics.outbound"), color: C2 },
  ];
  const disk: ChartSeries[] = [
    { key: "read", name: t("panel.metrics.read"), color: C1 },
    { key: "write", name: t("panel.metrics.write"), color: C2 },
  ];

  return (
    <section class="stack">
      <header class="metrics-head">
        <div class="metrics-head__text">
          <p class="muted">{t("panel.metrics.description")}</p>
          {locked ? (
            <p class="metrics-head__note">
              <Icon name="info" size={14} />
              {locked}
            </p>
          ) : null}
        </div>
        <div class="row">
          {updated ? (
            <span class="muted mono metrics-head__stamp">
              {t("panel.metrics.updated", { TIME: formatTime(updated, lang) })}
            </span>
          ) : null}
          <IconButton
            busy={load.loading}
            icon="arrow-clockwise"
            label={t("command.refresh")}
            onClick={load.reload}
          />
          <Tabs
            items={[
              { id: "24h", label: t("panel.metrics.day") },
              {
                id: "7d",
                label: t("panel.metrics.week"),
                disabled: Boolean(locked),
                title: locked,
              },
            ]}
            label={t("panel.metrics.range")}
            onChange={(id) => setRange(id as Range)}
            value={range}
            variant="pill"
          />
        </div>
      </header>

      {served ? (
        <p class="metrics-head__note" role="status">
          <Icon name="info" size={14} />
          {t("panel.metrics.weekServed")}
        </p>
      ) : null}

      {load.error && !rows ? (
        <Failure error={load.error} onRetry={load.reload} />
      ) : !rows ? (
        <div class="metrics-grid" aria-busy="true">
          {[0, 1, 2, 3].map((col) => (
            <div class="metrics-cell" key={col}>
              <Skeleton height={14} width={80} />
              <Skeleton col={col} height={160} />
            </div>
          ))}
        </div>
      ) : rows.cpu.length < 2 ? (
        <EmptyState
          description={t("panel.metrics.empty.body")}
          icon={NAV_ICON.metrics}
          title={t("panel.metrics.empty.title")}
        />
      ) : (
        <div class="metrics-grid" key={`${range}:${updated}`}>
          <Cell
            keys={peak}
            label={t("panel.metrics.cpu")}
            now={formatPercent(rows.cpu.at(-1)?.value ?? 0, lang)}
          >
            <Chart
              data={rows.cpu}
              label={t("panel.metrics.cpu")}
              series={
                peak ?? [
                  { key: "value", name: t("panel.metrics.cpu"), color: C1 },
                ]
              }
              type={weekly ? "line" : "area"}
              height={160}
              valueFormat={(v) => formatPercent(v, lang, 2)}
              x="t"
              xFormat={x}
              yFormat={(v) => formatPercent(v, lang, 0)}
            />
          </Cell>
          <Cell
            keys={peak}
            label={t("panel.metrics.ram")}
            now={bytes(rows.ram.at(-1)?.value ?? 0)}
          >
            <Chart
              data={rows.ram}
              label={t("panel.metrics.ram")}
              series={
                peak ?? [
                  { key: "value", name: t("panel.metrics.ram"), color: C1 },
                ]
              }
              ticks={niceByteTicks}
              type={weekly ? "line" : "area"}
              height={160}
              valueFormat={bytes}
              x="t"
              xFormat={x}
              yFormat={axis}
            />
          </Cell>
          <Cell keys={net} label={t("panel.metrics.network")}>
            <Chart
              data={rows.net}
              label={t("panel.metrics.network")}
              series={net}
              ticks={niceByteTicks}
              type="line"
              height={160}
              valueFormat={rate}
              x="t"
              xFormat={x}
              yFormat={axis}
            />
          </Cell>
          {rows.disk.length ? (
            <Cell keys={disk} label={t("panel.metrics.disk")}>
              <Chart
                data={rows.disk}
                label={t("panel.metrics.disk")}
                series={disk}
                ticks={niceByteTicks}
                type="line"
                height={160}
                valueFormat={bytes}
                x="t"
                xFormat={x}
                yFormat={axis}
              />
            </Cell>
          ) : null}
          {rows.storage.length ? (
            <Cell
              label={t("panel.metrics.storage")}
              now={bytes(
                rows.storage.findLast((r) => r.value !== null)?.value ?? 0,
              )}
            >
              <Chart
                data={rows.storage}
                label={t("panel.metrics.storage")}
                series={[
                  { key: "value", name: t("panel.metrics.storage"), color: C1 },
                ]}
                ticks={niceByteTicks}
                height={160}
                valueFormat={bytes}
                x="t"
                xFormat={x}
                yFormat={axis}
              />
            </Cell>
          ) : null}
        </div>
      )}
    </section>
  );
}

/**
 * One chart in the hairline grid: its label, a key when it draws more than
 * one line, the latest value, the chart.
 */
function Cell({
  label,
  keys,
  now,
  children,
}: {
  label: string;
  keys?: readonly ChartSeries[];
  now?: string;
  children: ComponentChildren;
}) {
  return (
    <div class="metrics-cell">
      <div class="metrics-cell__head">
        <h3 class="label">{label}</h3>
        {keys ? (
          <ul class="metrics-cell__keys">
            {keys.map((key) => (
              <li key={key.key}>
                <span class="chart__swatch" style={{ background: key.color }} />
                {key.name}
              </li>
            ))}
          </ul>
        ) : null}
        {now ? <span class="mono metrics-cell__now">{now}</span> : null}
      </div>
      {children}
    </div>
  );
}
