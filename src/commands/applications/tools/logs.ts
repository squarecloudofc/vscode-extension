import { ApplicationCommand } from "@/structures/application/command";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

export default new ApplicationCommand(
	"logsEntry",
	(extension, { application }) => {
		if (extension.api.paused) {
			return;
		}

		window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: t("logs.loading"),
			},
			async (progress) => {
				const logs = await extension.api.pauseUntil(() =>
					application.getLogs().catch(() => null),
				);

				progress.report({ increment: 100, message: ` ${t("generic.done")}` });

				if (!logs) {
					window.showErrorMessage(t("logs.null"));
					return;
				}

				return window
					.showInformationMessage(t("logs.loaded"), t("logs.button"))
					.then((showLogs) => {
						if (showLogs === t("logs.button")) {
							const outputChannel = window.createOutputChannel(
								application.name,
								"ansi",
							);

							outputChannel.append(logs);
							outputChannel.show();
						}
					});
			},
		);
	},
);
