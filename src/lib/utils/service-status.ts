import type { ServiceStatus } from "@/lib/store";

/**
 * The API types `status` as a bare string with no enum, and it reports
 * `online` — not `operational`, which is what the status bar compared against
 * since v5.0.0. A perfectly healthy platform was painted as a warning, next
 * to the word "online".
 *
 * One predicate for every surface that renders this: the bug only became
 * visible because the side bar footer and the status bar disagreed on the
 * same field, and two lists drift again the moment the API adds a word.
 *
 * ponytail: allowlist, because an unrecognised value should say something is
 * off rather than quietly claim everything is fine. If the platform starts
 * reporting a new healthy word, it lands here.
 */
const HEALTHY = new Set([
  "online",
  "operational",
  "ok",
  "up",
  "healthy",
  "normal",
]);

export function isServiceHealthy(status: ServiceStatus | undefined): boolean {
  // Nothing fetched yet is not the same as degraded — don't cry wolf.
  if (!status) return true;
  return HEALTHY.has(status.status.trim().toLowerCase());
}
