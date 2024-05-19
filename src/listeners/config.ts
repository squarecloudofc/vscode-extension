import { applicationsManager } from "@/api/applications";
import { coreConfig } from "@/config/core";
import { Config } from "@/constants/config";
import { workspace } from "vscode";

export function listenForApiKey() {
	return workspace.onDidChangeConfiguration(async (event) => {
		if (
			event.affectsConfiguration(Config.APIKey.toString()) &&
			(await coreConfig.testApiKey())
		) {
			await applicationsManager.refresh();
		}
	});
}
