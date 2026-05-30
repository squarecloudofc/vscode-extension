import { env, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { GenericTreeItem } from "@/treeviews/items/generic";
import { Command } from "@/structures/command";

export const copyText = new Command(
  "copyText",
  (_extension, treeItem: GenericTreeItem) => {
    const value = treeItem.description;
    if (typeof value !== "string" || value.length === 0) return;

    const label =
      typeof treeItem.label === "string"
        ? treeItem.label
        : treeItem.label?.label;

    env.clipboard.writeText(value);
    window.showInformationMessage(t("copy.copiedText", { TYPE: label ?? "" }));
  },
);
