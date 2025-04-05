import { ConfigFileParameters } from "@/config-file/parameters";
import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { SquareEasyExtension } from "@/managers/extension";
import type {
	ConfigFileAllowedParams,
	ConfigFileKeys,
} from "@/types/config-file";
import type * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

export function validateConfigFile(
	extension: SquareEasyExtension,
	document: vscode.TextDocument,
	diagnosticCollection: vscode.DiagnosticCollection,
): void {
	const diagnostics: vscode.Diagnostic[] = [];
	const lines = document.getText().split("\n");
	const keys: ConfigFileKeys = new Map();

	for (let line = 0; line < lines.length; line++) {
		const [key, value] = lines[line].split("=").map((part) => part.trim());

		if (!key) continue;
		if (!keys.has(key)) keys.set(key, { line, value });
		else
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.duplicateKey", { key }),
				),
			);
	}

	for (const key in ConfigFileParameters) {
		const parameter = ConfigFileParameters[key as ConfigFileAllowedParams];
		const current = keys.get(key);

		if (current) {
			parameter?.validation(
				keys,
				current.value,
				current.line,
				diagnostics,
				document,
			);
		} else if (parameter.required) {
			diagnostics.push(
				createDiagnostic(
					document,
					lines.length - 1,
					t("configFile.error.missingKey", { key }),
				),
			);
		}
	}

	diagnosticCollection.set(document.uri, diagnostics);
}
