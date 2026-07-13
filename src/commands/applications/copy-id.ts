import { env, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { ApplicationCommand } from "@/structures/application/command";

/** Copies an application ID to the clipboard with the standard toast. */
export async function copyApplicationId(id: string): Promise<void> {
  await env.clipboard.writeText(id);
  window.showInformationMessage(t("copy.copiedId"));
}

export const copyIdEntry = new ApplicationCommand(
  "copyIdEntry",
  (_extension, { application }) => copyApplicationId(application.id),
);
