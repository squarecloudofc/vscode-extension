import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { getLocale } from "@/lib/utils/locale";
import { Command } from "@/structures/command";

export const setApiKey = new Command("setApiKey", async (extension) => {
  const apiKeyUrl = `https://squarecloud.app/${getLocale()}/account/security`;

  const apiKey = await window.showInputBox({
    title: t("setApiKey.apiKey"),
    placeHolder: t("generic.paste"),
    ignoreFocusOut: true,
    password: true,
    prompt: `[${t("setApiKey.tutorial.button")}](${apiKeyUrl})`,
  });

  if (!apiKey) return;

  const isKeyValid = await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: t("setApiKey.testing"),
    },
    () => extension.config.apiKey.test(apiKey),
  );

  if (!isKeyValid) {
    window.showInformationMessage(t("setApiKey.invalid"));
    return;
  }

  await extension.config.apiKey.set(apiKey);
  extension.api.invalidateClient();
  await extension.api.refresh();

  window.showInformationMessage(t("setApiKey.success"));
});
