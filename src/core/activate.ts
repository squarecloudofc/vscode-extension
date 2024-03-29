import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";
import { treeViewsManager } from "../treeviews/manager";
import { ExtensionContext } from "vscode";
import applicationsStore from "../store/applications";
import { listenersManager } from "../listeners/manager";

export async function setUpExtension(context: ExtensionContext, lang: string) {
  console.log("[Square Cloud Easy] Starting!");

  loadTranslations(lang, context.extensionPath);
  listenersManager.register(context);
  treeViewsManager.register();

  applicationsStore.subscribe(() => treeViewsManager.refreshAll());
}

export async function activate(context: ExtensionContext): Promise<void> {
  await setUpExtension(context, getVscodeLang(process.env.VSCODE_NLS_CONFIG));
}
