// The pure half of the Network tab: time windows, analytics filters, status
// classes and the series the charts draw, ported from the site
// (dashboard/applications/[appId]/analytics and lib/utils/domain.ts). No
// imports: `node --test` loads this file directly.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The API keeps 7 days; a window can't be longer. */
export const MAX_WINDOW = 7 * DAY;

/** The site's presets. 7 days stops 2 minutes short of the limit. */
export const PRESETS = {
  "1h": HOUR,
  "24h": DAY,
  "3d": 3 * DAY,
  "7d": MAX_WINDOW - 2 * MINUTE,
} as const;
export type Preset = keyof typeof PRESETS;

export type Window = { start: string; end: string };

/**
 * A preset ending a minute ago, on the minute: the edge reports with a
 * delay, and the API caches by bucket, so the same minute asks the same.
 */
export function presetWindow(preset: Preset, now: number): Window {
  const end = Math.floor((now - MINUTE) / MINUTE) * MINUTE;
  return {
    start: new Date(end - PRESETS[preset]).toISOString(),
    end: new Date(end).toISOString(),
  };
}

/** A custom window must start first, end by now and fit in the last 7 days. */
export function validWindow(start: number, end: number, now: number): boolean {
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    start < end &&
    end <= now &&
    now - start <= MAX_WINDOW
  );
}

/** `AnalyticsFilters` the tab offers: each takes a breakdown's `type`. */
export const FILTER_KEYS = [
  "country",
  "path",
  "referer",
  "provider",
  "browser",
  "os",
  "protocol",
  "status",
  "content_type",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;

/** Only known keys with a short string survive (the host gets this). */
export function cleanFilters(value: unknown): Filters {
  const out: Filters = {};
  if (typeof value !== "object" || value === null) return out;
  for (const key of FILTER_KEYS) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === "string" && v && v.length <= 256) out[key] = v;
  }
  return out;
}

/** Clicking a row: sets that filter, or clears it when it's the one set. */
export function toggleFilter(
  filters: Filters,
  key: FilterKey,
  value: string,
): Filters {
  const next = { ...filters };
  if (next[key] === value) delete next[key];
  else next[key] = value;
  return next;
}

export type StatusClass = "2xx" | "3xx" | "4xx" | "5xx";

export function statusClass(code: number | string): StatusClass | undefined {
  const n = Number(code);
  if (n >= 200 && n < 300) return "2xx";
  if (n >= 300 && n < 400) return "3xx";
  if (n >= 400 && n < 500) return "4xx";
  if (n >= 500 && n < 600) return "5xx";
  return undefined;
}

/** Requests per status class with their share, in class order, none empty. */
export function classShares(
  buckets: readonly { type: string; requests: number }[],
): { cls: StatusClass; requests: number; share: number }[] {
  const totals = new Map<StatusClass, number>();
  let all = 0;
  for (const b of buckets) {
    const cls = statusClass(b.type);
    if (!cls) continue;
    totals.set(cls, (totals.get(cls) ?? 0) + b.requests);
    all += b.requests;
  }
  return (["2xx", "3xx", "4xx", "5xx"] as const).flatMap((cls) => {
    const requests = totals.get(cls) ?? 0;
    return requests ? [{ cls, requests, share: requests / all }] : [];
  });
}

type VisitPoint = {
  date: string;
  visits: number;
  requests: number;
  bytes: number;
  bytes_in?: number;
};

/** Chart rows by time: buckets with the same date (devices) are summed. */
export function visitRows(points: readonly VisitPoint[]) {
  const rows = new Map<
    number,
    { t: number; visits: number; requests: number; out: number; in: number }
  >();
  for (const p of points) {
    const t = Date.parse(p.date);
    if (!Number.isFinite(t)) continue;
    const row = rows.get(t) ?? { t, visits: 0, requests: 0, out: 0, in: 0 };
    row.visits += p.visits;
    row.requests += p.requests;
    row.out += p.bytes;
    row.in += p.bytes_in ?? 0;
    rows.set(t, row);
  }
  return [...rows.values()].sort((a, b) => a.t - b.t);
}

/** The errors timeseries as 4xx and 5xx per bucket. */
export function errorRows(
  points: readonly { date: string; buckets: Record<string, number> }[],
) {
  return points
    .map((p) => {
      const row = { t: Date.parse(p.date), "4xx": 0, "5xx": 0 };
      for (const [code, n] of Object.entries(p.buckets)) {
        const cls = statusClass(code);
        if (cls === "4xx" || cls === "5xx") row[cls] += n;
      }
      return row;
    })
    .filter((row) => Number.isFinite(row.t))
    .sort((a, b) => a.t - b.t);
}

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const SQUARE = /(^|\.)(squareweb|squarecloud)\.app$/;

/**
 * What a typed custom domain is saved as (lowercase, Punycode), as the
 * site does: scheme, path, port and trailing dots dropped; every label
 * 1–63 letters, digits or inner hyphens; two labels or more; a TLD that
 * isn't all digits. `reserved` for a Square Cloud address.
 */
export function normalizeDomain(
  input: string,
): { domain: string } | { error: "invalid" | "reserved" } {
  const bare = input
    .trim()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d*$/, "")
    .replace(/\.+$/, "");
  let host: string;
  try {
    host = new URL(`http://${bare}`).hostname;
  } catch {
    return { error: "invalid" };
  }
  const labels = host.split(".");
  if (
    !bare ||
    labels.length < 2 ||
    !labels.every((label) => LABEL.test(label)) ||
    /^\d+$/.test(labels.at(-1) ?? "")
  )
    return { error: "invalid" };
  if (SQUARE.test(host)) return { error: "reserved" };
  return { domain: host };
}

/** What a DNS record is for, from its name: the site's three roles. */
export function dnsRole(record: {
  name: string;
  fallback?: boolean;
}): "traffic" | "ownership" | "certificate" {
  if (record.fallback || record.name.startsWith("_acme-challenge"))
    return "certificate";
  if (record.name.startsWith("_cf-custom-hostname")) return "ownership";
  return "traffic";
}

/**
 * Whether the DNS records are worth reading again: none yet, or one not
 * active. A failed read is not pending: it shows its error with Retry.
 */
export function dnsPending(
  records: readonly { status: string }[] | undefined,
  error: unknown,
): boolean {
  if (error) return false;
  return !records?.length || records.some((r) => r.status !== "active");
}
