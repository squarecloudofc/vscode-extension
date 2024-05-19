import type { ExtensionContext } from "vscode";
import { onChangeAPIKey } from "../lib/listeners/config";

export class ListenersManager {
	register(context: ExtensionContext) {
		context.subscriptions.push(onChangeAPIKey());
	}
}

export const listeners = new ListenersManager();
