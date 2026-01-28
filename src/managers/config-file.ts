import * as vscode from "vscode";

import { ConfigFileActionProvider } from "@/providers/config-file/action";
import { ConfigCompletionProvider } from "@/providers/config-file/completion";
import { validateConfigFile } from "@/providers/config-file/validation";

import type { SquareCloudExtension } from "./extension";

export class ConfigFileManager {
  constructor(private readonly extension: SquareCloudExtension) {
    this.initialize();
  }

  /**
   * Initialize the config file manager.
   * this create the subscriptions and event listeners for the config file.
   */
  async initialize() {
    const diagnosticCollection =
      vscode.languages.createDiagnosticCollection("squarecloud");

    this.extension.context.subscriptions.push(diagnosticCollection);

    vscode.workspace.onDidChangeTextDocument((event) => {
      if (
        event.document.fileName.endsWith("squarecloud.app") ||
        event.document.fileName.endsWith("squarecloud.config")
      ) {
        validateConfigFile(
          this.extension,
          event.document,
          diagnosticCollection,
        );
      }
    });

    vscode.workspace.onDidOpenTextDocument((document) => {
      if (
        document.fileName.endsWith("squarecloud.app") ||
        document.fileName.endsWith("squarecloud.config")
      ) {
        validateConfigFile(this.extension, document, diagnosticCollection);
      }
    });

    this.extension.context.subscriptions.push(
      vscode.languages.registerCompletionItemProvider(
        { pattern: "**/{squarecloud.app,squarecloud.config}" },
        ConfigCompletionProvider,
        "=",
      ),
    );

    this.extension.context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        { pattern: "**/{squarecloud.app,squarecloud.config}" },
        new ConfigFileActionProvider(),
        {
          providedCodeActionKinds:
            ConfigFileActionProvider.providedCodeActionKinds,
        },
      ),
    );
  }
}
