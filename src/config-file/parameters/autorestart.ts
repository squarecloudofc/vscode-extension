import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

import type { ConfigFileParameter } from "@/types/config-file";
import { createDiagnostic } from "@/lib/utils/diagnostic";

export const AUTORESTART = {
  required: false,
  validation(_keys, value, line, diagnostics, document) {
    if (value !== "true" && value !== "false") {
      diagnostics.push(
        createDiagnostic(
          document,
          line,
          t("configFile.error.invalid.autoRestart"),
        ),
      );
    }
  },
  autocomplete(document, position) {
    return ["true", "false"].map((value) => {
      const item = new vscode.CompletionItem(
        value,
        vscode.CompletionItemKind.EnumMember,
      );

      item.range = document.getWordRangeAtPosition(
        position,
        /(?<=AUTORESTART=).*/,
      );

      return item;
    });
  },
} satisfies ConfigFileParameter;
