import type { ExtensionContext } from "vscode";
import { listenForApiKey } from "./config";

class ListenersManager {
	register(context: ExtensionContext) {
		context.subscriptions.push(listenForApiKey());
	}
}

export const listenersManager = new ListenersManager();
