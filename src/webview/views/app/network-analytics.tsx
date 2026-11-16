import type { ComponentChildren } from "preact";
import { useMemo, useState } from "preact/hooks";

import {
  BarList,
  type BarRow,
  Button,
  Card,
  Chart,
  type ChartSeries,
  EmptyState,
  Skeleton,
  Stat,
  StatGrid,
  Tabs,
} from "../../components";
import { NAV_ICON } from "../../icons";
import { locale, t } from "../../l10n";
import { niceByteTicks } from "../../lib/chart";
import {
  formatBytes,
  formatCount,
  formatDateTime,
  formatTime,
} from "../../lib/format";
import {
  classShares,
  type FilterKey,
  type Filters,
  statusClass,
  toggleFilter,
  visitRows,
} from "../../lib/network";
import { call } from "../../rpc";
import { Failure, useRpc } from "../shared/rpc";
import { countryName, type Query } from "./network";

// Analytics: the site's overview page. KPIs, the timeline and bandwidth,
// then the breakdowns; a click on any row filters every panel.

type Bucket = { type: string; visits: number; requests: number; bytes: number };

/** `NetworkAnalytics` in the SDK, as far as this reads it. */
type Analytics = {
  visits: {
    date: string;
    visits: number;
    requests: number;
    bytes: number;
    bytes_in?: number;
  }[];
  countries: Bucket[];
  os: Bucket[];
  browsers: Bucket[];
  protocols: Bucket[];
  paths: Bucket[];
  referers: Bucket[];
  providers: Bucket[];
  status_codes: Bucket[];
  content_types: Bucket[];
};

const BLUE = "var(--sq-blue)";
const ORANGE = "var(--sq-series-2)";
export const HTTP_COLOR = {
  "2xx": "var(--sq-http-2xx)",
  "3xx": "var(--sq-http-3xx)",
  "4xx": "var(--sq-http-4xx)",
  "5xx": "var(--sq-http-5xx)",
} as const;

const CLASS_LABEL = {
  "2xx": () => t("app.network.class.2xx"),
  "3xx": () => t("app.network.class.3xx"),
  "4xx": () => t("app.network.class.4xx"),
  "5xx": () => t("app.network.class.5xx"),
} as const;

/** One breakdown: which list, which filter its rows set. */
type Dimension = {
  id: keyof Analytics;
  filter: FilterKey;
  label: () => string;
};

const DIMENSIONS = {
  paths: {
    id: "paths",
    filter: "path",
    label: () => t("app.network.dim.paths"),
  },
  referers: {
    id: "referers",
    filter: "referer",
    label: () => t("app.network.dim.referers"),
  },
  providers: {
    id: "providers",
    filter: "provider",
    label: () => t("app.network.dim.providers"),
  },
  os: { id: "os", filter: "os", label: () => t("app.network.dim.os") },
  browsers: {
    id: "browsers",
    filter: "browser",
    label: () => t("app.network.dim.browsers"),
  },
  protocols: {
    id: "protocols",
    filter: "protocol",
    label: () => t("app.network.dim.protocols"),
  },
  status_codes: {
    id: "status_codes",
    filter: "status",
    label: () => t("app.network.dim.status"),
  },
  content_types: {
    id: "content_types",
    filter: "content_type",
    label: () => t("app.network.dim.content"),
  },
} satisfies Record<string, Dimension>;

const sum = (
  rows: readonly Omit<Bucket, "type">[],
  key: "visits" | "requests" | "bytes",
) => rows.reduce((total, row) => total + row[key], 0);

export function AnalyticsSection({
  query,
  filters,
  onFilters,
}: {
  query: Query;
  filters: Filters;
  onFilters(filters: Filters): void;
}) {
  const lang = locale();
  const load = useRpc<Analytics | null>(
    "network.analytics",
    { start: query.start, end: query.end, filters },
    `${query.key}|${JSON.stringify(filters)}`,
  );
  const rows = useMemo(
    () => (load.data ? visitRows(load.data.visits) : []),
    [load.data],
  );
  const filtered = Object.keys(filters).length > 0;

  if (load.error && load.data === undefined)
    return <Failure error={load.error} onRetry={load.reload} />;
  if (load.data === undefined)
    return (
      <div aria-busy="true" class="stack">
        <Skeleton height={104} />
        <div class="metrics-grid">
          {[0, 1].map((col) => (
            <div class="metrics-cell" key={col}>
              <Skeleton height={14} width={80} />
              <Skeleton col={col} height={180} />
            </div>
          ))}
        </div>
      </div>
    );
  if (load.data === null)
    return filtered ? (
      <EmptyState
        action={
          <Button onClick={() => onFilters({})} size="xs" variant="secondary">
            {t("app.network.filters.clear")}
          </Button>
        }
        description={t("app.network.filters.empty.body")}
        icon={NAV_ICON.metrics}
        title={t("app.network.filters.empty.title")}
      />
    ) : (
      <EmptyState
        action={
          <Button
            icon="arrow-square-out"
            onClick={() => void call("open", { target: "site" })}
            size="xs"
            variant="secondary"
          >
            {t("app.network.analytics.openSite")}
          </Button>
        }
        description={t("app.network.analytics.empty.body")}
        icon={NAV_ICON.metrics}
        title={t("app.network.analytics.empty.title")}
      />
    );

  const data = load.data;
  const span = Date.parse(query.end) - Date.parse(query.start);
  const x = (v: number) =>
    span > 36 * 3600_000 ? formatDateTime(v, lang) : formatTime(v, lang);
  const count = (v: number) => formatCount(v, lang);
  const bytes = (v: number) => formatBytes(v, lang, 1);
  const traffic: ChartSeries[] = [
    { key: "requests", name: t("app.network.requests"), color: BLUE },
    { key: "visits", name: t("app.network.visits"), color: ORANGE },
  ];
  const bandwidth: ChartSeries[] = [
    { key: "out", name: t("app.network.sent"), color: BLUE },
    { key: "in", name: t("app.network.received"), color: ORANGE },
  ];
  const sent = rows.reduce((n, r) => n + r.out, 0);
  const received = rows.reduce((n, r) => n + r.in, 0);

  const toRows = (
    list: readonly Bucket[],
    label: (type: string) => ComponentChildren = (type) => type,
    color?: (type: string) => string | undefined,
  ): BarRow[] =>
    list.map((b) => ({
      key: b.type,
      label: label(b.type),
      value: b.requests,
      display: count(b.requests),
      color: color?.(b.type),
      title: t("app.network.rowTitle", {
        REQUESTS: b.requests.toLocaleString(lang),
        VISITS: b.visits.toLocaleString(lang),
        BYTES: bytes(b.bytes),
      }),
    }));
  const list = (
    dimension: Dimension,
    label?: (type: string) => ComponentChildren,
    color?: (type: string) => string | undefined,
  ) => (
    <BarList
      active={filters[dimension.filter]}
      empty={t("app.network.analytics.listEmpty")}
      label={dimension.label()}
      onSelect={(value) =>
        onFilters(toggleFilter(filters, dimension.filter, value))
      }
      rows={toRows(data[dimension.id] as Bucket[], label, color)}
    />
  );
  const shares = classShares(data.status_codes);

  return (
    <div class="stack" key={query.key}>
      <StatGrid>
        <Stat
          label={t("app.network.requests")}
          value={count(sum(data.visits, "requests"))}
        />
        <Stat
          label={t("app.network.visits")}
          value={count(sum(data.visits, "visits"))}
        />
        <Stat
          hint={t("app.network.bandwidthHint", { RECEIVED: bytes(received) })}
          label={t("app.network.bandwidth")}
          value={bytes(sent)}
        />
        <Stat
          label={t("app.network.countries")}
          value={count(data.countries.length)}
        />
      </StatGrid>

      <div class="metrics-grid">
        <ChartCell keys={traffic} label={t("app.network.timeline")}>
          {rows.length > 1 ? (
            <Chart
              data={rows}
              height={180}
              label={t("app.network.timeline")}
              series={traffic}
              valueFormat={(v) => v.toLocaleString(lang)}
              x="t"
              xFormat={x}
              yFormat={count}
            />
          ) : (
            <p class="muted net-thin">{t("app.network.thin")}</p>
          )}
        </ChartCell>
        <ChartCell keys={bandwidth} label={t("app.network.bandwidth")}>
          {rows.length > 1 ? (
            <Chart
              data={rows}
              height={180}
              label={t("app.network.bandwidth")}
              series={bandwidth}
              ticks={niceByteTicks}
              type="line"
              valueFormat={bytes}
              x="t"
              xFormat={x}
              yFormat={bytes}
            />
          ) : (
            <p class="muted net-thin">{t("app.network.thin")}</p>
          )}
        </ChartCell>
      </div>

      <div class="net-grid">
        <Card flush title={t("app.network.dim.countries")}>
          <BarList
            active={filters.country}
            empty={t("app.network.analytics.listEmpty")}
            label={t("app.network.dim.countries")}
            onSelect={(value) =>
              onFilters(toggleFilter(filters, "country", value))
            }
            rows={toRows(data.countries, (code) => (
              <>
                {countryName(code, lang)}
                <span class="muted mono bar-list__code">{code}</span>
              </>
            ))}
          />
        </Card>
        <TabbedCard
          dimensions={[
            DIMENSIONS.paths,
            DIMENSIONS.referers,
            DIMENSIONS.providers,
          ]}
          render={(d) => list(d)}
          title={t("app.network.group.sources")}
        />
        <TabbedCard
          dimensions={[
            DIMENSIONS.os,
            DIMENSIONS.browsers,
            DIMENSIONS.protocols,
          ]}
          render={(d) => list(d)}
          title={t("app.network.group.clients")}
        />
        <TabbedCard
          title={t("app.network.group.responses")}
          dimensions={[DIMENSIONS.status_codes, DIMENSIONS.content_types]}
          render={(d) =>
            d.id === "status_codes" ? (
              <>
                {shares.length ? (
                  <div class="class-strip">
                    <div aria-hidden="true" class="class-strip__bar">
                      {shares.map((s) => (
                        <span
                          key={s.cls}
                          style={{
                            flexGrow: s.share,
                            background: HTTP_COLOR[s.cls],
                          }}
                        />
                      ))}
                    </div>
                    <ul class="class-strip__keys">
                      {shares.map((s) => (
                        <li key={s.cls}>
                          <span
                            class="chart__swatch"
                            style={{ background: HTTP_COLOR[s.cls] }}
                          />
                          <span class="mono">{s.cls}</span>
                          {CLASS_LABEL[s.cls]()}
                          <span class="mono muted">
                            {new Intl.NumberFormat(lang, {
                              style: "percent",
                              maximumFractionDigits: 1,
                            }).format(s.share)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {list(d, undefined, (code) => {
                  const cls = statusClass(code);
                  return cls ? HTTP_COLOR[cls] : undefined;
                })}
              </>
            ) : (
              list(d)
            )
          }
        />
      </div>
    </div>
  );
}

/** A card whose header switches between related breakdowns. */
function TabbedCard({
  title,
  dimensions,
  render,
}: {
  title: string;
  dimensions: readonly Dimension[];
  render: (dimension: Dimension) => ComponentChildren;
}) {
  const [at, setAt] = useState(dimensions[0]?.id);
  const current = dimensions.find((d) => d.id === at) ?? dimensions[0];
  if (!current) return null;
  return (
    <Card
      actions={
        <Tabs
          items={dimensions.map((d) => ({ id: d.id, label: d.label() }))}
          label={dimensions.map((d) => d.label()).join(", ")}
          onChange={(id) => setAt(id as keyof Analytics)}
          value={current.id}
          variant="pill"
        />
      }
      flush
      title={title}
    >
      {render(current)}
    </Card>
  );
}

/** A chart in the hairline grid with its key, as the Metrics tab's cells. */
export function ChartCell({
  label,
  keys,
  children,
}: {
  label: string;
  keys?: readonly ChartSeries[];
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
      </div>
      {children}
    </div>
  );
}
