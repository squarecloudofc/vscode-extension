import type { SquareCloudAPI } from "@squarecloud/api";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import { confirm } from "@/lib/utils/dialogs";
import { getLocale } from "@/lib/utils/locale";
import { getOutputChannel } from "@/lib/utils/output-channels";
import {
  ApplicationCommand,
  type ApplicationFilter,
  type ApplicationTarget,
  isWebsite,
} from "@/structures/application/command";

const HOUR = 60 * 60 * 1000;
const RANGE_OPTIONS = [
  { value: 1, unit: "hour", ms: HOUR },
  { value: 6, unit: "hour", ms: 6 * HOUR },
  { value: 24, unit: "hour", ms: 24 * HOUR },
  { value: 7, unit: "day", ms: 7 * 24 * HOUR },
] as const;

async function pickRange() {
  // Intl spells the duration in the UI language ("24 hours", "24 時間"), so
  // the ranges need no strings of their own.
  const picked = await window.showQuickPick(
    RANGE_OPTIONS.map((range) => ({
      label: new Intl.NumberFormat(getLocale(), {
        style: "unit",
        unit: range.unit,
        unitDisplay: "long",
      }).format(range.value),
      ms: range.ms,
    })),
    { title: t("network.pickRange") },
  );
  if (!picked) return undefined;
  const now = new Date();
  return {
    start: new Date(now.getTime() - picked.ms),
    end: now,
    label: picked.label,
  };
}

/**
 * Edge analytics are website-only. The account listing already says whether
 * the app serves a domain, so a non-web app is turned away without a request.
 */
function ensureWebsite({ application }: ApplicationTarget): boolean {
  if (isWebsite(application)) return true;
  window.showErrorMessage(t("network.notWebsite"));
  return false;
}

/** The picker offers only websites, so the check above never fires there. */
const WEBSITES: ApplicationFilter = {
  accepts: isWebsite,
  empty: () => t("apps.noneWebsite"),
};

interface NetworkRange {
  start: Date;
  end: Date;
}

interface NetworkAnalyticsConfig<T> {
  /** Command id (after the namespace prefix). */
  id: string;
  /** Channel name and report header: the command title, in the UI language. */
  title: () => string;
  /** SDK call that returns the analytics payload (`null` for an empty window). */
  fetch: (
    api: SquareCloudAPI,
    appId: string,
    range: NetworkRange,
  ) => Promise<T>;
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
  return new ApplicationCommand(
    config.id,
    async (extension, item, api) => {
      if (!ensureWebsite(item)) return;

      const range = await pickRange();
      if (!range) return;

      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: t("network.loading"),
        },
        async () => {
          const data = await config.fetch(api, item.application.id, range);
          if (data === null || config.isEmpty?.(data)) {
            window.showInformationMessage(t("network.empty"));
            return;
          }
          renderJsonChannel(
            extension,
            item.application.id,
            item.application.name,
            config.id,
            config.title(),
            range.label,
            data,
          );
        },
      );
    },
    WEBSITES,
  );
}

function renderJsonChannel(
  extension: SquareCloudExtension,
  appId: string,
  appName: string,
  id: string,
  title: string,
  rangeLabel: string,
  data: unknown,
) {
  const channel = getOutputChannel(
    extension.context.subscriptions,
    `network:${id}:${appId}`,
    `Square Cloud: ${title} (${appName})`,
  );
  channel.clear();
  channel.appendLine(`${title} · ${appName} · ${rangeLabel}`);
  channel.appendLine(JSON.stringify(data, null, 2));
  channel.show();
}

export const networkErrorsEntry = networkAnalyticsCommand({
  id: "networkErrorsEntry",
  title: () => t("command.networkErrors"),
  fetch: (api, appId, range) =>
    api.apps.network.errors(appId, range.start, range.end),
});

export const networkLogsEntry = networkAnalyticsCommand({
  id: "networkLogsEntry",
  title: () => t("command.networkLogs"),
  fetch: (api, appId, range) =>
    api.apps.network.logs(appId, range.start, range.end),
  isEmpty: (data) => data.length === 0,
});

export const networkPerformanceEntry = networkAnalyticsCommand({
  id: "networkPerformanceEntry",
  title: () => t("command.networkPerformance"),
  fetch: (api, appId, range) =>
    api.apps.network.performance(appId, range.start, range.end),
});

export const purgeCacheEntry = new ApplicationCommand(
  "purgeCacheEntry",
  async (_extension, item, api) => {
    if (!ensureWebsite(item)) return;

    if (!(await confirm(t("network.purgeConfirmAll"), { destructive: true })))
      return;

    await window.withProgress(
      { location: ProgressLocation.Notification, title: t("network.purging") },
      async () => {
        await api.apps.network.purgeCache(item.application.id);
        window.showInformationMessage(t("network.purged"));
      },
    );
  },
  WEBSITES,
);
