import * as vscode from "vscode";
import AssistantProvider from "../providers/assistant.provider";

class WebViewManager {
  public assistantView?: AssistantProvider;

  loadWebViews(context: vscode.ExtensionContext) {
    this.assistantView = new AssistantProvider(context.extensionUri);

    const disposable = vscode.window.registerWebviewViewProvider(AssistantProvider.viewType, this.assistantView);
    context.subscriptions.push(disposable);
  }
}

export default new WebViewManager();
