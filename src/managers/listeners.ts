import { Config } from "@/lib/constants";
import { workspace } from "vscode";
import type { SquareEasyExtension } from "./extension";

export class ListenersManager {
	constructor(private readonly extension: SquareEasyExtension) {
		extension.context.subscriptions.push(this.onChangeAPIKey());
	}

	onChangeAPIKey() {
		return workspace.onDidChangeConfiguration(async (event) => {
			if (
				event.affectsConfiguration(Config.APIKey.toString()) &&
				(await this.extension.config.apiKey.test())
			) {
				await this.extension.api.refresh();
			}
		});
	}
}
