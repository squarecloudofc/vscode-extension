import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { formatBytes } from "@/lib/utils/format";
import { getOutputChannel } from "@/lib/utils/output-channels";
import { ApplicationCommand } from "@/structures/application/command";

export const metricsEntry = new ApplicationCommand(
  "metricsEntry",
  (extension, { application }) =>
    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("metrics.loading"),
      },
      async (progress) => {
        const metrics = await application.getMetrics().catch(() => null);
        progress.report({ increment: 100, message: ` ${t("generic.done")}` });

        if (!metrics || metrics.length === 0) {
          window.showErrorMessage(t("metrics.null"));
          return;
        }

        const channel = getOutputChannel(
          extension.context.subscriptions,
          `metrics:${application.id}`,
          `Square Cloud Metrics (${application.name})`,
        );
        channel.clear();
        channel.appendLine(
          `Square Cloud — last 24h metrics (${metrics.length} samples, every 5min)`,
        );
        channel.appendLine(
          "timestamp                  cpu      ram         net(in+out)",
        );
        channel.appendLine("─".repeat(72));

        for (const point of metrics) {
          const ts = new Date(point.date).toISOString();
          const cpu = `${point.cpu.toFixed(1)}%`.padStart(6);
          const ram = formatBytes(point.ram).padStart(10);
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
          `current  cpu=${last.cpu.toFixed(1)}%  ram=${formatBytes(last.ram)}`,
        );
        channel.appendLine(
          `24h avg  cpu=${avgCpu.toFixed(1)}%  ram=${formatBytes(avgRam)}`,
        );

        channel.show();
      },
    ),
);
