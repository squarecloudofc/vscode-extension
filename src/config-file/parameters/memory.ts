import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

import type { ConfigFileParameter } from "@/types/config-file";
import { createDiagnostic } from "@/lib/utils/diagnostic";

export const memorySuggestions = [
  256, 512, 1024, 2048, 4096, 8192, 16384, 32768,
];

function legibleMemory(memory: number) {
  if (memory < 1024) return `${memory}MB`;
  if (memory < 1048576) return `${Math.floor(memory / 1024)}GB`;
  return memory.toString();
}

export const MEMORY = {
  required: true,
  /**
   * This function is used to autocomplete the memory value in the config file.
   */
  autocomplete(document, position) {
    const content = document.getText();
    const keys = new Set(
      content.split(/\r?\n/g).map((line) => {
        return line.split("=")[0]?.trim();
      }),
    );

    return memorySuggestions
      .filter((memory) => (keys.has("SUBDOMAIN") ? memory >= 512 : true))
      .map((memory, i) => {
        const completion = new vscode.CompletionItem(
          `${legibleMemory(memory)}`,
          vscode.CompletionItemKind.EnumMember,
        );

        completion.insertText = memory.toString();
        completion.sortText = String.fromCharCode(97 + i);
        completion.preselect = memory === 512;
        completion.range = document.getWordRangeAtPosition(
          position,
          /(?<=MEMORY=).*/,
        );

        return completion;
      });
  },
  validation(keys, value, line, diagnostics, document, extension) {
    const memory = keys.has("SUBDOMAIN") ? 512 : 256;
    const inserted = Number(value);
    const available = extension.store.value.user?.plan.memory.available;

    if (
      // Prevent spaces on the end or start
      value !== value.trim() ||
      // Prevent to be NaN, such as "MEMORY=dasdasd"
      Number.isNaN(inserted) ||
      /**
       * Verifies if the memory exceeds the minimum limit
       * @see {@link memory} for the minimum limit definition
       */
      memory > inserted
    ) {
      diagnostics.push(
        createDiagnostic(
          document,
          line,
          t("configFile.error.invalid.memory", { memory }),
        ),
      );
    }

    // Verifies that the user has available memory
    if (
      typeof available === "number" &&
      !Number.isNaN(inserted) &&
      inserted > available
    ) {
      // Create diagnostic message
      const diagnostic = createDiagnostic(
        document,
        line,
        t("configFile.error.unavailable.memory.message"),
      );

      // Insert url to upgrade plan
      diagnostic.code = {
        value: t("configFile.error.unavailable.memory.code"), // Link text
        target: vscode.Uri.parse("https://squarecloud.app/pay?state=upgrade"), // Link to upgrade plan
      };

      diagnostics.push(diagnostic);
    }
  },
} satisfies ConfigFileParameter;
