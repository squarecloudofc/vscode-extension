import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

import type { ConfigFileParameter } from "@/types/config-file";
import { createDiagnostic } from "@/lib/utils/diagnostic";

/**
 * RUNTIME accepts a curated list of runtime aliases as listed in the official
 * docs (https://docs.squarecloud.app/getting-started/config-file). The first
 * entry per group is the canonical name; the rest are aliases that the API
 * also accepts.
 */
export const RUNTIME_VALUES = [
  // Node ecosystem
  "nodejs",
  "javascript",
  "typescript",
  // Python
  "python",
  // .NET
  "dotnet",
  "csharp",
  "c#",
  // JVM
  "java",
  // Other runtimes
  "elixir",
  "rust",
  "php",
  // Go (canonical first per docs)
  "go",
  "golang",
  // Static sites
  "static",
  "html",
] as const;

const acceptedValues = new Set<string>(RUNTIME_VALUES);

export const RUNTIME = {
  required: false,
  validation(_keys, value, line, diagnostics, document) {
    // RUNTIME is optional — only flag when present but invalid. Case-insensitive
    // because the docs mix capitalisation in the table (e.g. "Elixir").
    const normalised = value.trim().toLowerCase();
    if (normalised.length > 0 && !acceptedValues.has(normalised)) {
      diagnostics.push(
        createDiagnostic(document, line, t("configFile.error.invalid.runtime")),
      );
    }
  },
  autocomplete(document, position) {
    return RUNTIME_VALUES.map((value, i) => {
      const item = new vscode.CompletionItem(
        value,
        vscode.CompletionItemKind.EnumMember,
      );
      item.range = document.getWordRangeAtPosition(position, /(?<=RUNTIME=).*/);
      item.sortText = String.fromCharCode(97 + i);
      return item;
    });
  },
} satisfies ConfigFileParameter;
