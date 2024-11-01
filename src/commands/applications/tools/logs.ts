import { ApplicationCommand } from "@/structures/application/command";
import { type OutputChannel, ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

const outputChannels = new Map<string, OutputChannel>();

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

				const outputChannel =
					outputChannels.get(application.id) ??
					window.createOutputChannel(
						`Square Cloud (${application.name})`,
						"ansi",
					);
				outputChannels.set(application.id, outputChannel);

				outputChannel.clear();
				outputChannel.append(logs);
				return outputChannel.show();
			},
		);
	},
);
