import {
  type Disposable,
  languages,
  type TextDocument,
  workspace,
} from "vscode";

import { ConfigFileActionProvider } from "@/providers/config-file/action";
import { ConfigCompletionProvider } from "@/providers/config-file/completion";
import { ConfigHoverProvider } from "@/providers/config-file/hover";
import { validateConfigFile } from "@/providers/config-file/validation";
import { FILES_SCHEME } from "@/webview/lib/files";

import type { SquareCloudExtension } from "./extension";

// Local files and application files opened through the squarecloud: file
// system. Other schemes (git diffs, for one) are copies of a file already
// checked, and would repeat its problems.
const SCHEMES = ["file", FILES_SCHEME];
const CONFIG_FILE_SELECTOR = SCHEMES.map((scheme) => ({
  scheme,
  pattern: "**/{squarecloud.app,squarecloud.config}",
}));
const VALIDATE_DEBOUNCE_MS = 200;

function isConfigFile(document: TextDocument): boolean {
  return (
    SCHEMES.includes(document.uri.scheme) &&
    (document.fileName.endsWith("squarecloud.app") ||
      document.fileName.endsWith("squarecloud.config"))
  );
}

export class ConfigFileManager implements Disposable {
  private readonly disposables: Disposable[] = [];

  constructor(extension: SquareCloudExtension) {
    const diagnostics = languages.createDiagnosticCollection("squarecloud");
    this.disposables.push(diagnostics);

    // Debounce per-document so rapid typing doesn't trigger N validations.
    const pending = new Map<string, ReturnType<typeof setTimeout>>();
    const scheduleValidate = (document: TextDocument) => {
      if (!isConfigFile(document)) return;
      const key = document.uri.toString();
      const existing = pending.get(key);
      if (existing) clearTimeout(existing);
      pending.set(
        key,
        setTimeout(() => {
          pending.delete(key);
          validateConfigFile(extension, document, diagnostics);
        }, VALIDATE_DEBOUNCE_MS),
      );
    };

    this.disposables.push(
      workspace.onDidChangeTextDocument((event) =>
        scheduleValidate(event.document),
      ),
      workspace.onDidOpenTextDocument(scheduleValidate),
      languages.registerCompletionItemProvider(
        CONFIG_FILE_SELECTOR,
        ConfigCompletionProvider,
        "=",
      ),
      languages.registerHoverProvider(
        CONFIG_FILE_SELECTOR,
        ConfigHoverProvider,
      ),
      languages.registerCodeActionsProvider(
        CONFIG_FILE_SELECTOR,
        new ConfigFileActionProvider(),
        {
          providedCodeActionKinds:
            ConfigFileActionProvider.providedCodeActionKinds,
        },
      ),
      // On dispose: drain any pending debounce timers so they don't fire after
      // the extension has been torn down.
      {
        dispose() {
          for (const timer of pending.values()) clearTimeout(timer);
          pending.clear();
        },
      },
    );

    // Validate any config files already open at activation time.
    for (const document of workspace.textDocuments) {
      if (isConfigFile(document))
        validateConfigFile(extension, document, diagnostics);
    }
  }

  dispose(): void {
    for (const d of this.disposables) d.dispose();
  }
}
