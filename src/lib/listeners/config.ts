import { applicationsManager } from "@/lib/api/applications";
import { configAPIKey } from "@/lib/config/apikey";
import { Config } from "@/lib/constants";
import { workspace } from "vscode";

export function onChangeAPIKey() {
	return workspace.onDidChangeConfiguration(async (event) => {
		if (
			event.affectsConfiguration(Config.APIKey.toString()) &&
			(await configAPIKey.test())
		) {
			await applicationsManager.refresh();
		}
	});
}
