import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import { t } from "vscode-ext-localisation";

export const SUBDOMAIN = {
	required: false,
	validation(keys, value, line, diagnostics, document) {
		// Validate if exists some value on SUBDOMAIN
		if (!value) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.missing.subdomain"),
				),
			);
		}

		// Validate if the SUBDOMAIN exceeds 62 characters
		if (value.length > 62) {
			diagnostics.push(
				createDiagnostic(document, line, t("configFile.error.long.subdomain")),
			);
		}

		// Validate if the SUBDOMAIN contains invalid characters
		if (!/^[a-zA-Z0-9-]+$/.test(value)) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.invalid.subdomain"),
				),
			);
		}
	},
} satisfies ConfigFileParameter;
