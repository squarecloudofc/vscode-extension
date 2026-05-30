import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { getOutputChannel } from "@/lib/utils/output-channels";
import { ApplicationCommand } from "@/structures/application/command";

export const logsEntry = new ApplicationCommand(
  "logsEntry",
  (extension, { application }) =>
    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("logs.loading"),
      },
      async (progress) => {
        const logs = await application.getLogs().catch(() => null);
        progress.report({ increment: 100, message: ` ${t("generic.done")}` });

        if (!logs) {
          window.showErrorMessage(t("logs.null"));
          return;
        }

        const channel = getOutputChannel(
          extension.context.subscriptions,
          `logs:${application.id}`,
          `Square Cloud (${application.name})`,
          { ansi: true },
        );
        channel.clear();
        channel.append(logs);
        channel.show();
      },
    ),
);
