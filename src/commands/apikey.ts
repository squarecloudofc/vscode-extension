import { Command } from "@/structures/command";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

export default new Command("setApiKey", async (extension) => {
	const apiKey = await window.showInputBox({
		title: t("setApiKey.apiKey"),
		placeHolder: t("generic.paste"),
		ignoreFocusOut: true,
	});

	if (!apiKey) {
		return;
	}

	const isKeyValid = await window.withProgress(
		{
			location: ProgressLocation.Notification,
			title: t("setApiKey.testing"),
		},
		async () => {
			return await extension.config.apiKey.test(apiKey);
		},
	);

	if (!isKeyValid) {
		window.showInformationMessage(t("setApiKey.invalid"));
		return;
	}

	await extension.config.apiKey.set(apiKey);
	await extension.api.refresh();

	window.showInformationMessage(t("setApiKey.success"));
});
