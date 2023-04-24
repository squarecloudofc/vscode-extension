import { getVscodeLang, loadTranslations } from 'vscode-ext-localisation';
import * as vscode from 'vscode';

class TranslationManager {
  loadTranslations(context: vscode.ExtensionContext) {
    loadTranslations(
      getVscodeLang(process.env.VSCODE_NLS_CONFIG),
      context.extensionPath
    );
  }
}

export default new TranslationManager();
