import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

export const VERSION = {
	required: true,
	validation(keys, value, line, diagnostics, document) {
		if (value !== "recommended" && value !== "latest") {
			diagnostics.push(
				createDiagnostic(document, line, t("configFile.error.invalid.version")),
			);
		}
	},
	autocomplete(document, position) {
		return ["recommended", "latest"].map(
			(value) =>
				new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember),
		);
	},
} satisfies ConfigFileParameter;
