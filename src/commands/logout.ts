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
  // The same path as a key changed in another window: drop the old client
  // (and the consoles holding it) and everything fetched with it, then the
  // sidebar goes back to sign-in.
  await extension.api.restartForNewKey();
});
