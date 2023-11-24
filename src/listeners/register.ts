import { ExtensionContext } from "vscode";
import { listenForApiKey } from "./config";

export function registerListeners(context: ExtensionContext) {
  const apiKeyListener = listenForApiKey();

  context.subscriptions.push(apiKeyListener);
}
