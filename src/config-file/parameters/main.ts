import { existsSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

import type { ConfigFileKeys, ConfigFileParameter } from "@/types/config-file";
import { AllowedExtensions } from "@/lib/constants";
import { createDiagnostic } from "@/lib/utils/diagnostic";

const notAllowedFolders = ["/node_modules", "/__pycache__", "/."];

/** RUNTIME with a value (an empty one counts as none, as on the platform). */
const hasRuntime = (keys: ConfigFileKeys) =>
  Boolean(keys.get("RUNTIME")?.value.trim());

export const MAIN = {
  // The platform needs MAIN unless RUNTIME is set: an upload with neither
  // is refused as MISSING_MAIN, as the docs say. START doesn't replace it.
  required: (keys) => !hasRuntime(keys),
  docs: () => t("configFile.hover.main"),
  validation(keys, value, line, diagnostics, document) {
    const configFilePath = dirname(document.uri.fsPath);
    const mainFilePath = resolve(configFilePath, value);
    const stats = existsSync(mainFilePath) ? statSync(mainFilePath) : undefined;
    // Judged relative to the config file: a project that lives under a
    // dot-folder is fine, and "../" (caught by "/.") leaves the project.
    const relativePath = relative(configFilePath, mainFilePath);
    const inProject = `/${relativePath.replaceAll("\\", "/")}`;

    // An empty MAIN is no file: fine next to RUNTIME, missing without it.
    if (!value) {
      if (!hasRuntime(keys))
        diagnostics.push(
          createDiagnostic(document, line, t("configFile.error.missing.main")),
        );
      return;
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
