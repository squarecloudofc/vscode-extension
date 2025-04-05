import { ConfigFileParameters } from "@/config-file/parameters";
import { createDiagnostic } from "@/lib/utils/diagnostic";
import { ConfigFileActionProvider } from "@/providers/config-file-action";
import { ConfigCompletionProvider } from "@/providers/config-file-completion";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";
import type { SquareEasyExtension } from "./extension";

export class ConfigFileManager {
	constructor(private readonly extension: SquareEasyExtension) {
		this.initialize();
	}

	async initialize() {
		const diagnosticCollection =
			vscode.languages.createDiagnosticCollection("squarecloud");

		this.extension.context.subscriptions.push(diagnosticCollection);

		vscode.workspace.onDidChangeTextDocument((event) => {
			if (
				event.document.fileName.endsWith("squarecloud.app") ||
				event.document.fileName.endsWith("squarecloud.config")
			) {
				this.validateConfigFile(event.document, diagnosticCollection);
			}
		});

		vscode.workspace.onDidOpenTextDocument((document) => {
			if (
				document.fileName.endsWith("squarecloud.app") ||
				document.fileName.endsWith("squarecloud.config")
			) {
				this.validateConfigFile(document, diagnosticCollection);
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

	private validateConfigFile(
		document: vscode.TextDocument,
		diagnosticCollection: vscode.DiagnosticCollection,
	): void {
		const diagnostics: vscode.Diagnostic[] = [];
		const lines = document.getText().split("\n");
		const keys = new Set<string>();

		for (let line = 0; line < lines.length; line++) {
			const [key, value] = lines[line].split("=").map((part) => part.trim());
			const parameter =
				ConfigFileParameters[key as keyof typeof ConfigFileParameters];

			if (!key || !parameter) continue;
			if (!keys.has(key)) keys.add(key);
			else
				diagnostics.push(
					createDiagnostic(
						document,
						line,
						t("configFile.error.duplicateKey", { key }),
					),
				);

			parameter.validation(keys, value, line, diagnostics, document);
		}

		diagnosticCollection.set(document.uri, diagnostics);
	}
}
