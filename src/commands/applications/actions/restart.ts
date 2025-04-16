import { ApplicationCommand } from "@/structures/application/command";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

export const restartEntry = new ApplicationCommand(
	"restartEntry",
	(extension, { application }) => {
		if (extension.api.paused) {
			return;
		}

		window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: t("restart.loading"),
			},
			async (progress) => {
				const app = await application.fetch();

				await extension.api.pauseUntil(() => app.restart());
				setTimeout(() => extension.api.refreshStatus(app.id), 7000);

				window.showInformationMessage(t("restart.loaded"));
				progress.report({ increment: 100 });
			},
		);
	},
);
