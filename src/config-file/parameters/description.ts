import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import { t } from "vscode-ext-localisation";

export const DESCRIPTION = {
	required: false,
	validation(keys, value, line, diagnostics, document) {
		if (!value) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.missing.description"),
				),
			);
		}

		if (value.length > 280) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.long.description"),
				),
			);
		}
	},
} satisfies ConfigFileParameter;
