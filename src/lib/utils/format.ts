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
