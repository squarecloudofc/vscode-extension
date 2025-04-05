import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import { t } from "vscode-ext-localisation";

export const START = {
	required: false,
	validation(keys, value, line, diagnostics, document) {
		// Validate if exists some value on START
		if (!value) {
			diagnostics.push(
				createDiagnostic(document, line, t("configFile.error.missing.start")),
			);
		}

		// Validate if the START exceeds 128 characters
		if (value.length > 128) {
			diagnostics.push(
				createDiagnostic(document, line, t("configFile.error.long.start")),
			);
		}
	},
} satisfies ConfigFileParameter;
