import * as vscode from "vscode";
import { getVscodeLang, loadTranslations } from "vscode-ext-localisation";

class TranslationManager {
  loadTranslations(context: vscode.ExtensionContext) {
    loadTranslations(getVscodeLang(process.env.VSCODE_NLS_CONFIG), context.extensionPath);
  }
}

export default new TranslationManager();
