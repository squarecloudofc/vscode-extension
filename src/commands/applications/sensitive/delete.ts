import { ApplicationCommand } from "@/structures/application/command";
import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

export default new ApplicationCommand(
	"deleteEntry",
	async (extension, { application }) => {
		if (extension.api.paused) {
			return;
		}

		const confirmDelete = await vscode.window.showInputBox({
			placeHolder: application.name,
			title: t("delete.confirm"),
		});

		if (confirmDelete !== application.name) {
			vscode.window.showInformationMessage(t("delete.cancelled"));
			return;
		}

		vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: t("delete.loading"),
			},
			async (progress) => {
				const backupUrl = await extension.api.pauseUntil(async () => {
					const backup = await application.backups.create();
					await application.delete();
					return backup.url;
				});

				setTimeout(() => extension.api.refreshStatus(application.id), 7000);

				vscode.window
					.showInformationMessage(t("delete.loaded"), "Download Backup")
					.then((value) => {
						if (value === "Download Backup") {
							vscode.env.openExternal(vscode.Uri.parse(backupUrl));
						}
					});

				progress.report({ increment: 100 });
			},
		);
	},
);
