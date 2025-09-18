export function formatMB(ram: number, hideMb?: boolean) {
  const formatted = Intl.NumberFormat("pt-BR", {
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
  }).format(ram);

  return formatted.replace(" MB", hideMb ? "" : "MB");
}

export function formatTime(timestamp: number): string {
  if (timestamp <= 0) {
    return "0s";
  }

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;
  const WEEK = 7 * DAY;
  const MONTH = 30 * DAY;
  const YEAR = 365 * DAY;

  let remaining = timestamp;
  const years = Math.floor(remaining / YEAR);
  remaining %= YEAR;

  const months = Math.floor(remaining / MONTH);
  remaining %= MONTH;

  const weeks = Math.floor(remaining / WEEK);
  remaining %= WEEK;

  const days = Math.floor(remaining / DAY);
  remaining %= DAY;

  const hours = Math.floor(remaining / HOUR);
  remaining %= HOUR;

  const minutes = Math.floor(remaining / MINUTE);
  remaining %= MINUTE;

  const seconds = Math.floor(remaining / SECOND);

  const parts: string[] = [];

  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.slice(0, 2).join(" ");
}
