import { applicationsManager } from "@/api/applications";
import { coreConfig } from "@/config/core";
import { CONFIG_API_KEY } from "@/constants/config";
import { workspace } from "vscode";

export function listenForApiKey() {
	return workspace.onDidChangeConfiguration(async (event) => {
		if (
			event.affectsConfiguration(CONFIG_API_KEY.toString()) &&
			(await coreConfig.testApiKey())
		) {
			await applicationsManager.refresh();
		}
	});
}
