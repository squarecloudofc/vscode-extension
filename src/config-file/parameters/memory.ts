import { createDiagnostic } from "@/lib/utils/diagnostic";
import type { ConfigFileParameter } from "@/types/config-file";
import { t } from "vscode-ext-localisation";

export const MEMORY = {
	required: true,
	validation(keys, value, line, diagnostics, document) {
		const memory = keys.has("SUBDOMAIN") ? 512 : 256;

		if (
			// previne espaços no começo/fim
			value !== value.trim() ||
			// verifica se não é NaN, como "MEMORY=dasdasd"
			Number.isNaN(Number(value)) ||
			// verifica se a memória é menor que o máximo
			Number(value) < memory
		) {
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
