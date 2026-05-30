import type { WebsiteApplication } from "@squarecloud/api";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import type { ApplicationTreeItem } from "@/treeviews/applications/item";
import { confirm } from "@/lib/utils/dialogs";
import { getOutputChannel } from "@/lib/utils/output-channels";
import { ApplicationCommand } from "@/structures/application/command";

const RANGE_OPTIONS = [
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "6h", ms: 6 * 60 * 60 * 1000 },
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
];

async function pickRange() {
  const picked = await window.showQuickPick(
    RANGE_OPTIONS.map((r) => r.label),
    { title: t("network.pickRange") },
  );
  if (!picked) return undefined;
  const range = RANGE_OPTIONS.find((r) => r.label === picked);
  if (!range) return undefined;
  const now = new Date();
  return {
    start: new Date(now.getTime() - range.ms),
    end: now,
    label: range.label,
  };
}

/**
 * Fetches the full WebsiteApplication for the given tree item. Returns
 * undefined and shows an error if the app has no domain (edge analytics are
 * website-only). Centralised so individual handlers don't duplicate the
 * fetch + isWebsite check.
 */
async function getWebsite({ application }: ApplicationTreeItem) {
  // Cheap pre-check — BaseApplication already knows whether the app has a
  // domain, so we can short-circuit before the network round-trip.
  if (application.domain === null) {
    window.showErrorMessage(t("network.notWebsite"));
    return undefined;
  }
  const full = await application.fetch();
  if (!full.isWebsite()) {
    window.showErrorMessage(t("network.notWebsite"));
    return undefined;
  }
  return full;
}

interface NetworkRange {
  start: Date;
  end: Date;
}

interface NetworkAnalyticsConfig<T> {
  /** Command id (after the namespace prefix). */
  id: string;
  /** Channel label suffix and JSON header. */
  suffix: string;
  /** SDK call that returns the analytics payload. */
  fetch: (app: WebsiteApplication, range: NetworkRange) => Promise<T>;
  /** When provided, drop the payload as empty if this returns true. */
  isEmpty?: (data: T) => boolean;
}

/**
 * Builds an ApplicationCommand that renders a JSON network analytics report
 * into a per-app OutputChannel. Used for the errors/logs/performance trio,
 * which share the same fetch → render → show flow with only the SDK call and
 * channel label changing.
 */
function networkAnalyticsCommand<T>(
  config: NetworkAnalyticsConfig<T>,
): ApplicationCommand {
  return new ApplicationCommand(config.id, async (extension, item) => {
    const app = await getWebsite(item);
    if (!app) return;

    const range = await pickRange();
    if (!range) return;

    await window.withProgress(
      { location: ProgressLocation.Notification, title: t("network.loading") },
      async () => {
        const data = await config
          .fetch(app, { start: range.start, end: range.end })
          .catch(() => null);
        if (data === null || config.isEmpty?.(data)) {
          window.showInformationMessage(t("network.empty"));
          return;
        }
        renderJsonChannel(
          extension,
          item.application.id,
          item.application.name,
          config.suffix,
          range.label,
          data,
        );
      },
    );
  });
}

function renderJsonChannel(
  extension: SquareCloudExtension,
  appId: string,
  appName: string,
  suffix: string,
  rangeLabel: string,
  data: unknown,
) {
  const channel = getOutputChannel(
    extension.context.subscriptions,
    `network:${suffix}:${appId}`,
    `Square Cloud ${suffix} (${appName})`,
  );
  channel.clear();
  channel.appendLine(`${suffix} — ${appName} — last ${rangeLabel}`);
  channel.appendLine(JSON.stringify(data, null, 2));
  channel.show();
}

const hasSummary = (data: unknown): boolean =>
  typeof data === "object" && data !== null && "summary" in data;

export const networkErrorsEntry = networkAnalyticsCommand({
  id: "networkErrorsEntry",
  suffix: "Errors",
  fetch: (app, range) => app.network.errors(range),
  isEmpty: (data) => !hasSummary(data),
});

export const networkLogsEntry = networkAnalyticsCommand({
  id: "networkLogsEntry",
  suffix: "Edge Logs",
  fetch: (app, range) => app.network.logs(range),
});

export const networkPerformanceEntry = networkAnalyticsCommand({
  id: "networkPerformanceEntry",
  suffix: "Performance",
  fetch: (app, range) => app.network.performance(range),
  isEmpty: (data) => !hasSummary(data),
});

export const purgeCacheEntry = new ApplicationCommand(
  "purgeCacheEntry",
  async (_extension, item) => {
    const app = await getWebsite(item);
    if (!app) return;

    if (!(await confirm(t("network.purgeConfirmAll"), { destructive: true })))
      return;

    await window.withProgress(
      { location: ProgressLocation.Notification, title: t("network.purging") },
      async () => {
        await app.network.purgeCache();
        window.showInformationMessage(t("network.purged"));
      },
    );
  },
);
