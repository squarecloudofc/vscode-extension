import { ApplicationCommand } from "@/structures/application/command";
import { env, window } from "vscode";
import { t } from "vscode-ext-localisation";

export default new ApplicationCommand(
	"copyIdEntry",
	async (_extension, { application }) => {
		await env.clipboard.writeText(application.id);
		window.showInformationMessage(t("copy.copiedId"));
	},
);
