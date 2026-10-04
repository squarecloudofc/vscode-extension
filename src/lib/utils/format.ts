const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/**
 * Auto-scales a byte count to the largest unit where the value is >= 1.
 * Use for arbitrary file sizes (snapshots, downloads).
 */
export function formatBytes(bytes: number, fractionDigits = 2): string {
  if (bytes <= 0) return `0 ${BYTE_UNITS[0]}`;
  const exp = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  return `${(bytes / 1024 ** exp).toFixed(fractionDigits)} ${BYTE_UNITS[exp]}`;
}

// One pair of quotes the shell takes as is: '...' without a ', or "..." with
// every inner " escaped and no lone \ before the closing quote.
const SHELL_QUOTED = /^(?:'[^']*'|"(?:[^"\\]|\\[\s\S])*")$/;
const SHELL_SAFE = /^[\p{L}\p{Nd}_@%+=:,./-]*$/u;

/**
 * The app loads its variables through a shell, which cuts a value at a space
 * and expands $, & or ; in it. shellQuote wraps such a value so the app reads
 * it back exactly as given: in single quotes, or in double quotes when it has
 * a single quote. A value already in one pair of quotes is left as the user
 * wrote it, e.g. "${HOST}:3000" to refer to another variable.
 *
 * Same rule as the CLI (internal/command/app/env/env.go), so both write alike.
 */
export function shellQuote(value: string): string {
  if (SHELL_QUOTED.test(value) || SHELL_SAFE.test(value)) return value;
  if (!value.includes("'")) return `'${value}'`;
  return `"${value.replace(/[\\"$`]/g, "\\$&")}"`;
}
