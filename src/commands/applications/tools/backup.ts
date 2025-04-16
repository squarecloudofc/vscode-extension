import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ApplicationCommand } from "@/structures/application/command";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

export const backupEntry = new ApplicationCommand(
	"backupEntry",
	async (extension, { application }) => {
		if (extension.api.paused) {
			return;
		}

		const dialog = await window.showOpenDialog({
			canSelectFolders: true,
			openLabel: t("backup.save"),
			title: `Backup - ${application.name}`,
		});

		if (!dialog) {
			return;
		}

		const [{ fsPath }] = dialog;

		window.withProgress(
			{
				location: ProgressLocation.Notification,
				title: t("backup.loading"),
			},
			async (progress) => {
				const buffer = await extension.api.pauseUntil(() =>
					application.backups.download(),
				);

				await writeFile(
					join(fsPath, `backup-${application.id}.zip`),
					new Uint8Array(buffer),
				);

				window.showInformationMessage(t("backup.loaded"));
				progress.report({ increment: 100 });
			},
		);
	},
);
