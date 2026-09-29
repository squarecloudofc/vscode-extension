import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { formatBytes } from "@/lib/utils/format";
import { getOutputChannel } from "@/lib/utils/output-channels";
import {
  ApplicationCommand,
  hasMetrics,
} from "@/structures/application/command";

/** Metric points carry RAM in MB (network stays in bytes). */
const MB = 1024 * 1024;

export const metricsEntry = new ApplicationCommand(
  "metricsEntry",
  (extension, { application }, api) =>
    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("metrics.loading"),
      },
      async (progress) => {
        // The API sends newest first; the table reads top-down in time.
        const metrics = await api.apps
          .metrics(application.id)
          .then((points) => points.reverse())
          .catch(() => null);
        progress.report({ increment: 100, message: ` ${t("generic.done")}` });

        if (!metrics || metrics.length === 0) {
          window.showErrorMessage(t("metrics.null"));
          return;
        }

        const channel = getOutputChannel(
          extension.context.subscriptions,
          `metrics:${application.id}`,
          t("metrics.channel", { NAME: application.name }),
        );
        channel.clear();
        channel.appendLine(t("metrics.header"));
        // Timestamps are ISO in UTC, so the column says UTC; CPU, RAM and NET
        // read the same in every language and keep the table aligned.
        channel.appendLine(
          `${"UTC".padEnd(24)}  ${"CPU".padStart(6)}  ${"RAM".padStart(10)}  NET`,
        );
        channel.appendLine("─".repeat(72));

        for (const point of metrics) {
          const ts = new Date(point.date).toISOString();
          const cpu = `${point.cpu.toFixed(1)}%`.padStart(6);
          const ram = formatBytes(point.ram * MB).padStart(10);
          const net = point.net.reduce((a, b) => a + b, 0);
          channel.appendLine(`${ts}  ${cpu}  ${ram}  ${formatBytes(net)}`);
        }

        const last = metrics[metrics.length - 1];
        const avgCpu =
          metrics.reduce((sum, p) => sum + p.cpu, 0) / metrics.length;
        const avgRam =
          metrics.reduce((sum, p) => sum + p.ram, 0) / metrics.length;
        channel.appendLine("─".repeat(72));
        channel.appendLine(
          t("metrics.latest", {
            CPU: `${last.cpu.toFixed(1)}%`,
            RAM: formatBytes(last.ram * MB),
          }),
        );
        channel.appendLine(
          t("metrics.average", {
            CPU: `${avgCpu.toFixed(1)}%`,
            RAM: formatBytes(avgRam * MB),
          }),
        );

        channel.show();
      },
    ),
  { accepts: hasMetrics, empty: () => t("apps.noneMetrics") },
);
