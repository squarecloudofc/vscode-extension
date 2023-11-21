import * as vscode from "vscode";
import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";

export function setUpExtension(context: vscode.ExtensionContext, lang: string) {
  loadTranslations(lang, context.extensionPath);
}

export function activate(context: vscode.ExtensionContext): void {
  setUpExtension(context, getVscodeLang(process.env.VSCODE_NLS_CONFIG));
}
