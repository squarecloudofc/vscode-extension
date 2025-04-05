import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

export const MEMORY = {
	required: true,
	validation(keys, value, line, diagnostics, document, extension) {
		const memory = keys.has("SUBDOMAIN") ? 512 : 256;
		const inserted = Number(value);
		const available = extension.store.value.user?.plan.memory.available;

		if (
			// Prevent spaces on the end or start
			value !== value.trim() ||
			// Prevent to be NaN, such as "MEMORY=dasdasd"
			Number.isNaN(inserted) ||
			/**
			 * Verifies if the memory exceeds the minimum limit
			 * @see {@link memory} for the minimum limit definition
			 */
			memory > inserted
		) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.invalid.memory", { memory }),
				),
			);
		}

		// Verifies that the user has available memory
		if (
			typeof available === "number" &&
			!Number.isNaN(inserted) &&
			inserted > available
		) {
			// Create diagnostic message
			const diagnostic = createDiagnostic(
				document,
				line,
				t("configFile.error.unavailable.memory"),
			);

			// Insert url to upgrade plan
			diagnostic.code = {
				value: "Fazer upgrade", // Link text
				target: vscode.Uri.parse("https://squarecloud.app/pay?state=upgrade"), // Link to upgrade plan
			};

			diagnostics.push(diagnostic);
		}
	},
} satisfies ConfigFileParameter;
