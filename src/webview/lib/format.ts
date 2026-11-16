// Number formatting for the webview, ported from the site
// (apps/website/src/lib/utils/format-bytes.ts). No imports: `node --test`
// loads this file directly.

// French writes octets, like the site; every other locale the byte symbols.
const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB", "PB"] as const;
const OCTET_UNITS = ["o", "ko", "Mo", "Go", "To", "Po"] as const;

const formats = new Map<string, Intl.NumberFormat>();
function numberFormat(locale: string, options: Intl.NumberFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    formats.set(key, format);
  }
  return format;
}

/**
 * A size as its number and its unit, for a tile that styles them apart.
 * Base 1024, up to `decimals` fraction digits (trailing zeros dropped).
 */
export function formatBytesParts(
  bytes: number,
  locale: string,
  decimals = 2,
): { value: string; unit: string } {
  // A counter that went backwards (a reset) formats as 0, not out of range.
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  const digits = Math.max(0, decimals);
  let i =
    value < 1
      ? 0
      : Math.min(
          Math.floor(Math.log(value) / Math.log(1024)),
          BYTE_UNITS.length - 1,
        );
  // 1023.999 kB would round to "1024 kB": that is the next unit.
  if (
    i < BYTE_UNITS.length - 1 &&
    Number((value / 1024 ** i).toFixed(digits)) >= 1024
  )
    i++;
  const units = locale.toLowerCase().startsWith("fr")
    ? OCTET_UNITS
    : BYTE_UNITS;
  return {
    value: numberFormat(locale, { maximumFractionDigits: digits }).format(
      value / 1024 ** i,
    ),
    unit: units[i] ?? "B",
  };
}

/** "1.75 MB" in en, "1,75 MB" in pt-br, "1,75 Mo" in fr (no-break space). */
export function formatBytes(
  bytes: number,
  locale: string,
  decimals = 2,
): string {
  const { value, unit } = formatBytesParts(bytes, locale, decimals);
  return `${value}\u00a0${unit}`;
}

/**
 * A percentage given in points (0.4 → "0.4%"), in the locale's own form
 * ("0,4 %" in fr). Not a number reads as an em dash.
 */
export function formatPercent(
  points: number,
  locale: string,
  decimals = 1,
): string {
  if (!Number.isFinite(points)) return "—";
  return numberFormat(locale, {
    style: "percent",
    maximumFractionDigits: Math.max(0, decimals),
  }).format(points / 100);
}

const dates = new Map<string, Intl.DateTimeFormat>();
function dateFormat(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dates.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, options);
    dates.set(key, format);
  }
  return format;
}

/** "15:02", or "15:02:11" with `seconds`, on the locale's clock. */
export function formatTime(ms: number, locale: string, seconds = false) {
  return dateFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: seconds ? "2-digit" : undefined,
  }).format(ms);
}

/** "Nov 15, 15:02": a short date and its time; the date alone with `dateOnly`. */
export function formatDateTime(ms: number, locale: string, dateOnly = false) {
  return dateFormat(locale, {
    month: "short",
    day: "numeric",
    hour: dateOnly ? undefined : "2-digit",
    minute: dateOnly ? undefined : "2-digit",
  }).format(ms);
}

/** "1.2K" in en, "1,2 mil" in pt-br: a count where room is short. */
export function formatCount(n: number, locale: string): string {
  return numberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(n) ? n : 0);
}

/** A latency: "184 ms" below a second, "1.2 s" from one. No value is "—". */
export function formatMs(ms: number | null, locale: string): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  return ms < 1000
    ? numberFormat(locale, {
        style: "unit",
        unit: "millisecond",
        maximumFractionDigits: 0,
      }).format(ms)
    : numberFormat(locale, {
        style: "unit",
        unit: "second",
        maximumFractionDigits: 1,
      }).format(ms / 1000);
}
