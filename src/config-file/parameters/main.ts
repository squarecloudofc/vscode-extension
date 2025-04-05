import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";
import { AllowedExtensions } from "../../lib/config/extensions";

export const MAIN = {
	required: true,
	validation(keys, value, line, diagnostics, document) {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		const workspaceRoot = workspaceFolders
			? workspaceFolders[0].uri.fsPath
			: "";

		const mainFilePath = resolve(workspaceRoot, value);

		// Validate if there is some value on MAIN
		if (!value) {
			diagnostics.push(
				createDiagnostic(document, line, t("configFile.error.missing.main")),
			);
		}

		// Validate if the file exists
		if (!workspaceRoot || !existsSync(mainFilePath)) {
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
		 * This function map all project files on project
		 * and provide them as completion items
		 */
		const workspaceFolders = vscode.workspace.workspaceFolders;

		if (!workspaceFolders) return;

		const folder = workspaceFolders[0].uri.fsPath;
		const files = vscode.workspace.findFiles(`**/*.{${AllowedExtensions}}`);

		return files.then((uris) =>
			uris.map((uri) => {
				const relativePath = relative(folder, uri.fsPath);
				const item = new vscode.CompletionItem(
					relativePath,
					vscode.CompletionItemKind.File,
				);
				item.insertText = relativePath;
				item.range = document.getWordRangeAtPosition(position, /(?<=MAIN=).*/);
				return item;
			}),
		);
	},
} satisfies ConfigFileParameter;
