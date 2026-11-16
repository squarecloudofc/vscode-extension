import type { AppTab, NetworkSection } from "@/webview/protocol";
import {
  ApplicationCommand,
  type ApplicationFilter,
} from "@/structures/application/command";

import { WEBSITES } from "./network";

/**
 * Commands that used to print into an output channel (logs, the realtime
 * stream, metrics, the edge reports) or report a restore on its request
 * alone now open the app's panel on the tab that does it. Same IDs, so
 * keybindings still work.
 */
const openTab = (
  name: string,
  tab: AppTab | `network.${NetworkSection}`,
  filter?: ApplicationFilter,
) =>
  new ApplicationCommand(
    name,
    (extension, { application }) =>
      extension.panels.openResource("app", application.id, tab),
    filter,
  );

export const logsEntry = openTab("logsEntry", "logs");
export const realtimeEntry = openTab("realtimeEntry", "logs");
export const metricsEntry = openTab("metricsEntry", "metrics");
export const snapshotRestoreEntry = openTab(
  "snapshotRestoreEntry",
  "snapshots",
);
// The picker offers only websites: network data needs a domain.
export const networkLogsEntry = openTab(
  "networkLogsEntry",
  "network.logs",
  WEBSITES,
);
export const networkErrorsEntry = openTab(
  "networkErrorsEntry",
  "network.errors",
  WEBSITES,
);
export const networkPerformanceEntry = openTab(
  "networkPerformanceEntry",
  "network.performance",
  WEBSITES,
);
