import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";
import { AllowedExtensions } from "../../lib/config/extensions";

export const MAIN = {
	validation(keys, value, line, diagnostics, document) {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		const workspaceRoot = workspaceFolders
			? workspaceFolders[0].uri.fsPath
			: "";

		if (!workspaceRoot) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.invalid.main", { file: value }),
				),
			);
		}

		const mainFilePath = resolve(workspaceRoot, value);

		if (!existsSync(mainFilePath)) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.invalid.main", { file: value }),
				),
			);
		}
	},
	autocomplete(document, position) {
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
