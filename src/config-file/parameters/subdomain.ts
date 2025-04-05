import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import { t } from "vscode-ext-localisation";

export const SUBDOMAIN = {
	validation(keys, value, line, diagnostics, document) {
		if (value.length > 62) {
			diagnostics.push(
				createDiagnostic(document, line, t("configFile.error.long.subdomain")),
			);
		}

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
