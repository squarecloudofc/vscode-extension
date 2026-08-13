import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { Command } from "@/structures/command";

export const logout = new Command("logout", async (extension) => {
  const account = await extension.config.apiKey.getAccount();

  const confirmed = await confirm(
    account
      ? t("logout.confirmAccount", { EMAIL: account.email })
      : t("logout.confirm"),
    { destructive: true },
  );
  if (!confirmed) return;

  await extension.config.apiKey.set(undefined);
  extension.api.invalidateClient();
  // Drop what was fetched with the old authorization before the sidebar swaps
  // back, so nothing from the previous account survives the handover.
  extension.api.clearState();
  await extension.treeViews.auth.syncVisibility();
});
