import type { ServiceStatus } from "@squarecloud/api";

import type { ServiceSummary } from "@/webview/protocol";

/**
 * The platform's status in one word, shared by the sidebar footer and the
 * status bar so they never disagree on the same answer.
 *
 * - `unknown`: nothing fetched yet, or the API's own check could not run.
 *   "Couldn't check", never an error look: it is not evidence of an outage.
 * - `maintenance`: the summary says so, or every open incident is one.
 * - `degraded`: degradation, any word the API adds later, or an open
 *   incident on the status page even while the summary says online.
 * - `online`: everything else.
 *
 * ponytail: allowlist of healthy words, so an unrecognised one says something
 * is off rather than quietly claiming all is fine.
 */
const HEALTHY = new Set(["online", "operational", "ok", "up", "healthy"]);

export function serviceSummary(
  status: ServiceStatus | undefined,
): ServiceSummary {
  const word = status?.status.trim().toLowerCase();
  if (!word || word === "unknown") return "unknown";
  if (word === "maintenance") return "maintenance";
  if (!HEALTHY.has(word)) return "degraded";
  const incidents = status?.incidents ?? [];
  if (!incidents.length) return "online";
  return incidents.every((incident) => incident.type === "maintenance")
    ? "maintenance"
    : "degraded";
}
