import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { isInformational } from "@/lib/utils/errors";
import { ApplicationCommand } from "@/structures/application/command";

/**
 * Builds an ApplicationCommand for the three lifecycle actions that share the
 * same shape — show progress, fire the action, schedule a status refresh,
 * toast on success.
 */
function lifecycleCommand(action: "start" | "stop" | "restart") {
  return new ApplicationCommand(
    `${action}Entry`,
    async (extension, { application }, api) =>
      window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: t(`${action}.loading`),
        },
        async () => {
          await api.apps[action](application.id).catch((error) => {
            // "Already started/stopped" means the row was stale: resync it,
            // then let the command report the 409 as information.
            if (isInformational(error)) {
              void extension.api.refreshStatus(application.id);
            }
            throw error;
          });
          // Follow the state until it actually changes instead of guessing a
          // single delay — a stopped app should read "stopped" right away.
          void extension.api.trackStatusChange(application.id);
          window.showInformationMessage(t(`${action}.loaded`));
        },
      ),
    // The picker offers start for what isn't running, and stop/restart for
    // what isn't known to be stopped — an unknown status gets both.
    action === "start"
      ? {
          accepts: (_, status) => status?.running !== true,
          empty: () => t("apps.allRunning"),
        }
      : {
          accepts: (_, status) => status?.running !== false,
          empty: () => t("apps.noneRunning"),
        },
  );
}

export const startEntry = lifecycleCommand("start");
export const stopEntry = lifecycleCommand("stop");
export const restartEntry = lifecycleCommand("restart");
