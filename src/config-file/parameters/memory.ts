import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import { t } from "vscode-ext-localisation";

export const MEMORY = {
	validation(keys, value, line, diagnostics, document) {
		const memory = keys.has("SUBDOMAIN") ? 512 : 256;

		if (Number.isNaN(Number(value)) || Number(value) < memory) {
			diagnostics.push(
				createDiagnostic(
					document,
					line,
					t("configFile.error.invalid.memory", { memory }),
				),
			);
		}
	},
} satisfies ConfigFileParameter;
