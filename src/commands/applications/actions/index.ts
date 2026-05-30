import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { ApplicationCommand } from "@/structures/application/command";

/**
 * Builds an ApplicationCommand for the three lifecycle actions that share the
 * same shape — show progress, fire the action, schedule a status refresh,
 * toast on success.
 */
function lifecycleCommand(action: "start" | "stop" | "restart") {
  return new ApplicationCommand(
    `${action}Entry`,
    async (extension, { application }) =>
      window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: t(`${action}.loading`),
        },
        async () => {
          await application[action]();
          extension.api.scheduleStatusRefresh(application.id);
          window.showInformationMessage(t(`${action}.loaded`));
        },
      ),
  );
}

export const startEntry = lifecycleCommand("start");
export const stopEntry = lifecycleCommand("stop");
export const restartEntry = lifecycleCommand("restart");
