import * as vscode from "vscode";
import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";
import { TreeViewsManager } from "../treeviews/manager";

export function setUpExtension(context: vscode.ExtensionContext, lang: string) {
  loadTranslations(lang, context.extensionPath);

  const treeViews = new TreeViewsManager();
  treeViews.registerTreeViews();
}

export function activate(context: vscode.ExtensionContext): void {
  setUpExtension(context, getVscodeLang(process.env.VSCODE_NLS_CONFIG));
}
