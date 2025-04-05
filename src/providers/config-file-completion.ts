import { ConfigFileParameters } from "@/config-file/parameters";
import type { ConfigFileAllowedParams } from "@/types/config-file";
import * as vscode from "vscode";

export const ConfigCompletionProvider: vscode.CompletionItemProvider = {
	provideCompletionItems(document, position) {
		const line = document.lineAt(position).text.trim();
		const isKey = !line.includes("=");
		const existingKeys = new Set(
			document
				.getText()
				.split("\n")
				.map((line) => line.split("=")[0].trim()),
		);

		if (isKey) {
			return Object.keys(ConfigFileParameters)
				.filter((key) => !existingKeys.has(key))
				.sort(
					(key) =>
						+ConfigFileParameters[key as ConfigFileAllowedParams].required,
				)
				.map((key) => {
					const item = new vscode.CompletionItem(
						key,
						vscode.CompletionItemKind.Property,
					);
					item.insertText = `${key}=`;
					item.command = {
						command: "editor.action.triggerSuggest",
						title: "Trigger Suggest",
					};
					return item;
				});
		}

		if (line.startsWith("MAIN=")) {
			return ConfigFileParameters.MAIN.autocomplete(document, position);
		}

		if (line.startsWith("VERSION=")) {
			return ConfigFileParameters.VERSION.autocomplete(document, position);
		}

		if (line.startsWith("AUTORESTART=")) {
			return ConfigFileParameters.AUTORESTART.autocomplete(document, position);
		}

		return undefined;
	},
};
