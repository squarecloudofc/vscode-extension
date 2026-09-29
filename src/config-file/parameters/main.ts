import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
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
    // Judged relative to the config file: a project that lives under a
    // dot-folder is fine, and "../" (caught by "/.") leaves the project.
    const relativePath = relative(configFilePath, mainFilePath);
    const inProject = `/${relativePath.replaceAll("\\", "/")}`;

    // Validate if there is some value on MAIN
    if (!value) {
      diagnostics.push(
        createDiagnostic(document, line, t("configFile.error.missing.main")),
      );
    }

    // Validate if the file exists, is a file, and is inside config file root path
    if (
      !stats?.isFile() ||
      isAbsolute(relativePath) ||
      notAllowedFolders.some((folder) => inProject.includes(folder))
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
        // Filtered on the path inside the project, like the validation above:
        // "/." also drops "../" siblings, and a parent folder named "dist"
        // or ".projects" no longer hides every file.
        .map((uri) =>
          relative(configFilePath, uri.fsPath).replaceAll("\\", "/"),
        )
        .filter(
          (relativePath) =>
            !isAbsolute(relativePath) &&
            !`/${relativePath}`.includes("/dist/") &&
            !notAllowedFolders.some((folder) =>
              `/${relativePath}`.includes(folder),
            ),
        )
        .map((relativePath) => {
          // Forward slashes in the label too, or typing "src/" filters every
          // Windows suggestion out.
          const item = new vscode.CompletionItem(
            relativePath,
            vscode.CompletionItemKind.File,
          );
          item.insertText = relativePath;
          item.range = document.getWordRangeAtPosition(
            position,
            /(?<=MAIN=).*/,
          );
          return item;
        }),
    );
  },
} satisfies ConfigFileParameter;
