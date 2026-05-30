import { existsSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

import type { ConfigFileParameter } from "@/types/config-file";
import { AllowedExtensions } from "@/lib/constants";
import { createDiagnostic } from "@/lib/utils/diagnostic";

const notAllowedFolders = ["/node_modules", "/__pycache__", "/."];

export const MAIN = {
  // The official docs state: "Não é necessário se START estiver definido."
  // Treat MAIN as required only when START is missing — otherwise the user is
  // using a custom start command and doesn't need to declare a main file.
  required: (keys) => !keys.has("START"),
  validation(_keys, value, line, diagnostics, document) {
    const configFilePath = dirname(document.uri.fsPath);
    const mainFilePath = resolve(configFilePath, value);
    const stats = existsSync(mainFilePath) ? statSync(mainFilePath) : undefined;

    // Validate if there is some value on MAIN
    if (!value) {
      diagnostics.push(
        createDiagnostic(document, line, t("configFile.error.missing.main")),
      );
    }

    // Validate if the file exists, is a file, and is inside config file root path
    if (
      !stats?.isFile() ||
      !mainFilePath.startsWith(configFilePath) ||
      notAllowedFolders.some((folder) =>
        mainFilePath.replaceAll("\\", "/").includes(folder),
      )
    ) {
      diagnostics.push(
        createDiagnostic(
          document,
          line,
          t("configFile.error.invalid.mainFile", { file: value }),
        ),
      );
    }
  },
  autocomplete(document, position) {
    /**
     * This function maps all project files relative to the config file
     * and provides them as completion items.
     */
    const configFilePath = dirname(document.uri.fsPath);
    const files = vscode.workspace.findFiles(`**/*.{${AllowedExtensions}}`);

    return files.then((uris) =>
      uris
        .filter(
          (uri) =>
            uri.fsPath.startsWith(configFilePath) &&
            !uri.fsPath.includes("dist") &&
            !notAllowedFolders.some((folder) =>
              uri.fsPath.replaceAll("\\", "/").includes(folder),
            ),
        )
        .map((uri) => {
          const relativePath = relative(configFilePath, uri.fsPath);
          const item = new vscode.CompletionItem(
            relativePath,
            vscode.CompletionItemKind.File,
          );
          item.insertText = relativePath.replaceAll("\\", "/");
          item.range = document.getWordRangeAtPosition(
            position,
            /(?<=MAIN=).*/,
          );
          return item;
        }),
    );
  },
} satisfies ConfigFileParameter;
