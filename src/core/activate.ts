import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";
import { treeViewsManager } from "../treeviews/manager";
import { registerListeners } from "../listeners/register";
import { ExtensionContext } from "vscode";

export function setUpExtension(context: ExtensionContext, lang: string) {
  loadTranslations(lang, context.extensionPath);
  registerListeners(context);

  treeViewsManager.registerTreeViews();
}

export function activate(context: ExtensionContext): void {
  setUpExtension(context, getVscodeLang(process.env.VSCODE_NLS_CONFIG));
}
