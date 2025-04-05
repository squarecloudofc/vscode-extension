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
			// previne espaços no começo/fim
			value !== value.trim() ||
			// verifica se não é NaN, como "MEMORY=dasdasd"
			Number.isNaN(inserted) ||
			// verifica se a memória é menor que o máximo
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

		// verifica se o usuário tem memória disponivel
		if (
			typeof available === "number" &&
			!Number.isNaN(inserted) &&
			inserted > available
		) {
			const diagnostic = createDiagnostic(
				document,
				line,
				t("configFile.error.unavailable.memory"),
			);

			diagnostic.code = {
				value: "Fazer upgrade", // Replace with your desired link
				target: vscode.Uri.parse("https://squarecloud.app/pay?state=upgrade"), // Replace with your desired link
			};

			diagnostics.push(diagnostic);
		}
	},
} satisfies ConfigFileParameter;
