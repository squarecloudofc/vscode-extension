import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import {
  ApplicationCommand,
  type ApplicationFilter,
  type ApplicationTarget,
  isWebsite,
} from "@/structures/application/command";

/**
 * Edge routes are website-only. The account listing already says whether
 * the app serves a domain, so a non-web app is turned away without a request.
 */
function ensureWebsite({ application }: ApplicationTarget): boolean {
  if (isWebsite(application)) return true;
  window.showErrorMessage(t("network.notWebsite"));
  return false;
}

/** The picker offers only websites, so the check above never fires there. */
export const WEBSITES: ApplicationFilter = {
  accepts: isWebsite,
  empty: () => t("apps.noneWebsite"),
};

// The edge reports (logs, errors, performance) open the panel's Network tab:
// see ./panel.ts.

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
      },
    );
  },
  WEBSITES,
);
