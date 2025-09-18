import { env, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { ApplicationCommand } from "@/structures/application/command";

export const copyIdEntry = new ApplicationCommand(
  "copyIdEntry",
  async (_extension, { application }) => {
    await env.clipboard.writeText(application.id);
    window.showInformationMessage(t("copy.copiedId"));
  },
);
