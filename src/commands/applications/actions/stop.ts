import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { ApplicationCommand } from "@/structures/application/command";

export const stopEntry = new ApplicationCommand(
  "stopEntry",
  (extension, { application }) => {
    if (extension.api.paused) {
      return;
    }

    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("stop.loading"),
      },
      async (progress) => {
        const app = await application.fetch();

        await extension.api.pauseUntil(() => app.stop());
        setTimeout(() => extension.api.refreshStatus(app.id), 7000);

        window.showInformationMessage(t("stop.loaded"));
        progress.report({ increment: 100 });
      },
    );
  },
);
