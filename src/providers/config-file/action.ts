import * as vscode from "vscode";

import type { RUNTIME_VALUES } from "@/config-file/parameters/runtime";

/**
 * Quick-fix actions surfaced for known invalid values in the config file.
 * Each branch covers fields whose accepted values are a small known set.
 */
export class ConfigFileActionProvider implements vscode.CodeActionProvider {
  static providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] | undefined {
    const line = document.lineAt(range.start.line).text.trim();

    if (line.startsWith("AUTORESTART=")) {
      return this.enumFixes(document, range, "AUTORESTART", ["true", "false"]);
    }
    if (line.startsWith("VERSION=")) {
      return this.enumFixes(document, range, "VERSION", [
        "recommended",
        "latest",
      ]);
    }
    if (line.startsWith("RUNTIME=")) {
      // Offer the canonical names only — full alias list would clutter the
      // quick-fix menu and aliases are also valid via autocomplete.
      const canonical = [
        "nodejs",
        "typescript",
        "python",
        "dotnet",
        "java",
        "elixir",
        "rust",
        "php",
        "go",
        "static",
      ] satisfies Array<(typeof RUNTIME_VALUES)[number]>;
      return this.enumFixes(document, range, "RUNTIME", canonical);
    }
    return undefined;
  }

  private enumFixes(
    document: vscode.TextDocument,
    range: vscode.Range,
    field: string,
    values: readonly string[],
  ): vscode.CodeAction[] {
    return values.map((value) => {
      const fix = new vscode.CodeAction(
        `Set ${field}=${value}`,
        vscode.CodeActionKind.QuickFix,
      );
      fix.edit = new vscode.WorkspaceEdit();
      fix.edit.replace(document.uri, range, `${field}=${value}`);
      return fix;
    });
  }
}
