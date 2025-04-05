import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

export const AUTORESTART = {
	required: false,
	validation(keys, value, line, diagnostics, document) {
		if (!["true", "false"].includes(value)) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.invalid.autoRestart"),
				),
			);
		}
	},
	autocomplete(document, position) {
		return ["true", "false"].map(
			(value) =>
				new vscode.CompletionItem(value, vscode.CompletionItemKind.EnumMember),
		);
	},
} satisfies ConfigFileParameter;
