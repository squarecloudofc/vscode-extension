import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";
import { AllowedExtensions } from "../../lib/config/extensions";

export const MAIN = {
	required: true,
	validation(keys, value, line, diagnostics, document) {
		const configFilePath = dirname(document.uri.fsPath);
		const mainFilePath = resolve(configFilePath, value);

		// Validate if there is some value on MAIN
		if (!value) {
			diagnostics.push(
				createDiagnostic(document, line, t("configFile.error.missing.main")),
			);
		}

		// Validate if the file exists
		if (!existsSync(mainFilePath)) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.invalid.mainFile", { file: value }),
				),
			);
		}

		// Validate if the file is inside the project
		if (!mainFilePath.startsWith(configFilePath)) {
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
						!uri.fsPath.includes("dist"),
				)
				.map((uri) => {
					const relativePath = relative(configFilePath, uri.fsPath);
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
