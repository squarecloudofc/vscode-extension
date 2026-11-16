import { Fragment } from "preact";
import { useMemo, useState } from "preact/hooks";

import {
  BarList,
  Card,
  Chart,
  type ChartSeries,
  type Column,
  EmptyState,
  Input,
  Skeleton,
  Stat,
  StatGrid,
  Table,
} from "../../components";
import { Icon } from "../../components/icon";
import { NAV_ICON } from "../../icons";
import { locale, t } from "../../l10n";
import {
  formatCount,
  formatDateTime,
  formatMs,
  formatTime,
} from "../../lib/format";
import { errorRows, statusClass } from "../../lib/network";
import { Failure, useRpc } from "../shared/rpc";
import { countryName, isUpgrade, Paywall, type Query } from "./network";
import { ChartCell, HTTP_COLOR } from "./network-analytics";

// The site's other Analytics pages: access logs, errors and performance.
// Logs and performance come with Pro and Enterprise (403 UPGRADE_REQUIRED).

/** Rows drawn at once; the rest is a filter away. */
const LOG_ROWS = 200;

const httpColor = (code: number | string) => {
  const cls = statusClass(code);
  return cls ? HTTP_COLOR[cls] : undefined;
};

function Loading() {
  return (
    <div aria-busy="true" class="stack">
      <Skeleton height={104} />
      <Skeleton height={240} />
    </div>
  );
}

/** A status code in its class's colour, as the site's logs. */
function Status({ code }: { code: number }) {
  return (
    <span class="http-status mono" style={{ "--http": httpColor(code) }}>
      {code}
    </span>
  );
}

/** `NetworkLog` in the SDK, as far as this reads it. */
type Log = {
  timestamp: string;
  client: { ip: string | null; country: string | null };
  request: { method: string; path: string; query: string | null };
  response: { status: number };
};

export function LogsSection({ query }: { query: Query }) {
  const lang = locale();
  const load = useRpc<Log[]>(
    "network.logs",
    { start: query.start, end: query.end },
    query.key,
  );
  const [filter, setFilter] = useState("");
  const time = useMemo(
    () =>
      new Intl.DateTimeFormat(lang, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    [lang],
  );
  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (load.data ?? [])
      .map((log, i) => ({
        ...log,
        i,
        at: Date.parse(log.timestamp),
        country: countryName(log.client.country, lang),
      }))
      .filter(
        (log) =>
          !needle ||
          [
            log.request.method,
            log.request.path,
            log.response.status,
            log.client.ip,
            log.client.country,
            log.country,
          ]
            .join(" ")
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => b.at - a.at);
  }, [load.data, filter, lang]);

  if (load.error && !load.data)
    return isUpgrade(load.error) ? (
      <Paywall
        body={t("app.network.logs.paywall.body")}
        icon={NAV_ICON.logs}
        title={t("app.network.logs.paywall.title")}
      />
    ) : (
      <Failure error={load.error} onRetry={load.reload} />
    );
  if (!load.data) return <Loading />;
  if (!load.data.length)
    return (
      <EmptyState
        description={t("app.network.logs.empty.body")}
        icon={NAV_ICON.logs}
        title={t("app.network.logs.empty.title")}
      />
    );

  type Row = (typeof rows)[number];
  const columns: Column<Row>[] = [
    {
      key: "time",
      label: t("app.network.logs.time"),
      mono: true,
      width: "1%",
      render: (r) => <span class="net-time">{time.format(r.at)}</span>,
    },
    {
      key: "method",
      label: t("app.network.logs.method"),
      mono: true,
      width: "84px",
      render: (r) => r.request.method,
    },
    {
      key: "path",
      label: t("app.network.logs.path"),
      mono: true,
      render: (r) => (
        <span class="net-path">
          {r.request.path}
          {r.request.query ? (
            <span class="muted">?{r.request.query}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "status",
      label: t("app.network.filter.status"),
      width: "84px",
      render: (r) => <Status code={r.response.status} />,
    },
    {
      key: "ip",
      label: t("app.network.logs.ip"),
      mono: true,
      render: (r) => r.client.ip ?? "—",
    },
    {
      key: "country",
      label: t("app.network.filter.country"),
      render: (r) => r.country,
    },
  ];

  return (
    <div class="stack">
      <div class="logs__bar">
        <Input
          aria-label={t("app.network.logs.filter")}
          class="logs__search"
          icon="magnifying-glass"
          onInput={(event) => setFilter(event.currentTarget.value)}
          placeholder={t("app.network.logs.filter")}
          spellcheck={false}
          type="search"
          value={filter}
        />
        {rows.length > LOG_ROWS ? (
          <span class="muted">
            {t("app.network.logs.showing", {
              SHOWN: LOG_ROWS,
              TOTAL: rows.length.toLocaleString(lang),
            })}
          </span>
        ) : null}
      </div>
      <Table
        columns={columns}
        empty={t("app.network.logs.noMatch", { QUERY: filter.trim() })}
        label={t("app.network.section.logs")}
        rowKey={(r) => String(r.i)}
        rows={rows.slice(0, LOG_ROWS)}
      />
    </div>
  );
}

/** `NetworkErrors` in the SDK. */
type Errors = {
  summary: { total: number; by_class: { "4xx": number; "5xx": number } };
  by_status: { status: number; requests: number }[];
  timeseries: { date: string; buckets: Record<string, number> }[];
  top_paths: {
    path: string;
    method: string | null;
    total: number;
    by_status: Record<string, number>;
  }[];
};

export function ErrorsSection({ query }: { query: Query }) {
  const lang = locale();
  const [with4xx, setWith4xx] = useState(false);
  const load = useRpc<Errors | null>(
    "network.errors",
    { start: query.start, end: query.end, include4xx: with4xx },
    `${query.key}|${with4xx}`,
  );
  const rows = useMemo(
    () => (load.data ? errorRows(load.data.timeseries) : []),
    [load.data],
  );

  const toggle = (
    <label class="check" title={t("app.network.errors.include4xxHint")}>
      <input
        checked={with4xx}
        onChange={(event) => setWith4xx(event.currentTarget.checked)}
        type="checkbox"
      />
      {t("app.network.errors.include4xx")}
      <span class="muted">· {t("app.network.errors.include4xxHint")}</span>
    </label>
  );

  if (load.error && load.data === undefined)
    return (
      <div class="stack">
        {toggle}
        <Failure error={load.error} onRetry={load.reload} />
      </div>
    );
  if (load.data === undefined)
    return (
      <div class="stack">
        {toggle}
        <Loading />
      </div>
    );
  if (load.data === null)
    return (
      <div class="stack">
        {toggle}
        <EmptyState
          description={t("app.network.errors.empty.body")}
          icon={NAV_ICON.errors}
          title={t("app.network.errors.empty.title")}
        />
      </div>
    );

  const data = load.data;
  const span = Date.parse(query.end) - Date.parse(query.start);
  const x = (v: number) =>
    span > 36 * 3600_000 ? formatDateTime(v, lang) : formatTime(v, lang);
  const series: ChartSeries[] = [
    { key: "5xx", name: "5xx", color: HTTP_COLOR["5xx"] },
    ...(with4xx ? [{ key: "4xx", name: "4xx", color: HTTP_COLOR["4xx"] }] : []),
  ];
  type Path = Errors["top_paths"][number];
  const columns: Column<Path>[] = [
    {
      key: "path",
      label: t("app.network.logs.path"),
      mono: true,
      render: (r) => <span class="net-path">{r.path}</span>,
    },
    {
      key: "method",
      label: t("app.network.logs.method"),
      mono: true,
      width: "84px",
      render: (r) => r.method ?? "—",
    },
    {
      key: "statuses",
      label: t("app.network.filter.status"),
      render: (r) => (
        <span class="row row--tight http-list">
          {Object.entries(r.by_status)
            .sort((a, b) => b[1] - a[1])
            .map(([code, n]) => (
              <span class="http-pill" key={code}>
                <Status code={Number(code)} />
                <span class="muted mono">×{n.toLocaleString(lang)}</span>
              </span>
            ))}
        </span>
      ),
    },
    {
      key: "total",
      label: t("app.network.errors.total"),
      align: "end",
      mono: true,
      width: "96px",
      render: (r) => r.total.toLocaleString(lang),
    },
  ];

  return (
    <div class="stack" key={query.key}>
      {toggle}
      <StatGrid columns={with4xx ? 3 : 2}>
        <Stat
          label={t("app.network.errors.total")}
          value={formatCount(data.summary.total, lang)}
        />
        {with4xx ? (
          <Stat
            label={
              <>
                <span
                  class="key-dot"
                  style={{ background: HTTP_COLOR["4xx"] }}
                />
                {t("app.network.errors.by4xx")}
              </>
            }
            value={formatCount(data.summary.by_class["4xx"], lang)}
          />
        ) : null}
        <Stat
          label={
            <>
              <span class="key-dot" style={{ background: HTTP_COLOR["5xx"] }} />
              {t("app.network.errors.by5xx")}
            </>
          }
          value={formatCount(data.summary.by_class["5xx"], lang)}
        />
      </StatGrid>
      <div class="metrics-grid">
        <ChartCell keys={series} label={t("app.network.errors.overTime")}>
          {rows.length > 1 ? (
            <Chart
              data={rows}
              height={180}
              label={t("app.network.errors.overTime")}
              series={series}
              type={with4xx ? "line" : "area"}
              valueFormat={(v) => v.toLocaleString(lang)}
              x="t"
              xFormat={x}
              yFormat={(v) => formatCount(v, lang)}
            />
          ) : (
            <p class="muted net-thin">{t("app.network.thin")}</p>
          )}
        </ChartCell>
        <div class="metrics-cell metrics-cell--flush">
          <div class="metrics-cell__head">
            <h3 class="label">{t("app.network.errors.byStatus")}</h3>
          </div>
          <BarList
            empty={t("app.network.analytics.listEmpty")}
            label={t("app.network.errors.byStatus")}
            rows={data.by_status.map((s) => ({
              key: String(s.status),
              label: <span class="mono">{s.status}</span>,
              value: s.requests,
              display: s.requests.toLocaleString(lang),
              color: httpColor(s.status),
            }))}
          />
        </div>
      </div>
      <Card flush title={t("app.network.errors.paths")}>
        <Table
          class="table-wrap--flush"
          columns={columns}
          empty={t("app.network.errors.pathsEmpty")}
          label={t("app.network.errors.paths")}
          rowKey={(r) => `${r.method}:${r.path}`}
          rows={data.top_paths}
        />
      </Card>
    </div>
  );
}

type Percentiles = {
  p50: number | null;
  p95: number | null;
  p99: number | null;
};

/** `NetworkPerformance` in the SDK, as far as this reads it. */
type Performance = {
  summary: { edge: Percentiles; origin: Percentiles; requests: number };
  timeseries: { date: string; edge: Percentiles; origin: Percentiles }[];
  countries: { type: string; p95: number | null; requests: number }[];
  slowest_paths: {
    path: string;
    p95: number | null;
    p99: number | null;
    requests: number;
  }[];
};

export function PerformanceSection({ query }: { query: Query }) {
  const lang = locale();
  const load = useRpc<Performance | null>(
    "network.performance",
    { start: query.start, end: query.end },
    query.key,
  );
  const rows = useMemo(
    () =>
      (load.data?.timeseries ?? [])
        .map((p) => ({
          t: Date.parse(p.date),
          edge: p.edge.p95,
          origin: p.origin.p95,
        }))
        .filter((r) => Number.isFinite(r.t))
        .sort((a, b) => a.t - b.t),
    [load.data],
  );

  if (load.error && load.data === undefined)
    return isUpgrade(load.error) ? (
      <Paywall
        body={t("app.network.performance.paywall.body")}
        icon={NAV_ICON.performance}
        title={t("app.network.performance.paywall.title")}
      />
    ) : (
      <Failure error={load.error} onRetry={load.reload} />
    );
  if (load.data === undefined) return <Loading />;
  if (load.data === null)
    return (
      <EmptyState
        description={t("app.network.performance.empty.body")}
        icon={NAV_ICON.performance}
        title={t("app.network.performance.empty.title")}
      />
    );

  const data = load.data;
  const ms = (v: number | null) => formatMs(v, lang);
  const span = Date.parse(query.end) - Date.parse(query.start);
  const x = (v: number) =>
    span > 36 * 3600_000 ? formatDateTime(v, lang) : formatTime(v, lang);
  const series: ChartSeries[] = [
    {
      key: "edge",
      name: t("app.network.performance.edge"),
      color: "var(--sq-blue)",
    },
    {
      key: "origin",
      name: t("app.network.performance.origin"),
      color: "var(--sq-series-2)",
    },
  ];
  type Slow = Performance["slowest_paths"][number];
  const columns: Column<Slow>[] = [
    {
      key: "path",
      label: t("app.network.logs.path"),
      mono: true,
      render: (r) => <span class="net-path">{r.path}</span>,
    },
    {
      key: "p95",
      label: "p95",
      align: "end",
      mono: true,
      width: "96px",
      render: (r) => ms(r.p95),
    },
    {
      key: "p99",
      label: "p99",
      align: "end",
      mono: true,
      width: "96px",
      render: (r) => ms(r.p99),
    },
    {
      key: "requests",
      label: t("app.network.requests"),
      align: "end",
      mono: true,
      width: "110px",
      render: (r) => r.requests.toLocaleString(lang),
    },
  ];

  const percentiles = (p: Percentiles) => (
    <dl class="facts">
      {(["p50", "p95", "p99"] as const).map((k) => (
        <Fragment key={k}>
          <dt class="mono">{k}</dt>
          <dd class="mono">{ms(p[k])}</dd>
        </Fragment>
      ))}
    </dl>
  );

  return (
    <div class="stack" key={query.key}>
      <StatGrid columns={3}>
        <Stat
          label={t("app.network.requests")}
          value={formatCount(data.summary.requests, lang)}
        />
        <Stat
          label={
            <>
              <span class="key-dot" style={{ background: "var(--sq-blue)" }} />
              {t("app.network.performance.edgeP95")}
            </>
          }
          value={ms(data.summary.edge.p95)}
        />
        <Stat
          label={
            <>
              <span
                class="key-dot"
                style={{ background: "var(--sq-series-2)" }}
              />
              {t("app.network.performance.originP95")}
            </>
          }
          value={ms(data.summary.origin.p95)}
        />
      </StatGrid>
      <div class="grid-2">
        <Card title={t("app.network.performance.edge")}>
          <div class="stack stack--tight">
            <p class="muted">{t("app.network.performance.edgeBody")}</p>
            {percentiles(data.summary.edge)}
          </div>
        </Card>
        <Card title={t("app.network.performance.origin")}>
          <div class="stack stack--tight">
            <p class="muted">{t("app.network.performance.originBody")}</p>
            {percentiles(data.summary.origin)}
          </div>
        </Card>
      </div>
      <div class="metrics-grid">
        <ChartCell keys={series} label={t("app.network.performance.overTime")}>
          {rows.length > 1 ? (
            <Chart
              data={rows}
              height={180}
              label={t("app.network.performance.overTime")}
              series={series}
              type="line"
              valueFormat={ms}
              x="t"
              xFormat={x}
              yFormat={ms}
            />
          ) : (
            <p class="muted net-thin">{t("app.network.thin")}</p>
          )}
        </ChartCell>
        <div class="metrics-cell metrics-cell--flush">
          <div class="metrics-cell__head">
            <h3 class="label">{t("app.network.performance.countries")}</h3>
          </div>
          <BarList
            empty={t("app.network.analytics.listEmpty")}
            label={t("app.network.performance.countries")}
            rows={data.countries.map((c) => ({
              key: c.type,
              label: countryName(c.type, lang),
              value: c.requests,
              display: `p95 ${ms(c.p95)}`,
              title: `${c.requests.toLocaleString(lang)} · p95 ${ms(c.p95)}`,
            }))}
          />
        </div>
      </div>
      <Card flush title={t("app.network.performance.slowest")}>
        <Table
          class="table-wrap--flush"
          columns={columns}
          empty={t("app.network.performance.slowestEmpty")}
          label={t("app.network.performance.slowest")}
          rowKey={(r) => r.path}
          rows={data.slowest_paths}
        />
      </Card>
      <p class="muted net-note">
        <Icon name="info" size={14} />
        {t("app.network.performance.sampling")}
      </p>
    </div>
  );
}
