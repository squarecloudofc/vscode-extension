import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import { t } from "vscode-ext-localisation";

export const START = {
	validation(keys, value, line, diagnostics, document) {
		if (value.length > 128) {
			diagnostics.push(
				createDiagnostic(document, line, t("configFile.error.long.start")),
			);
		}
	},
} satisfies ConfigFileParameter;
