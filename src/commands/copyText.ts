import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { GenericTreeItem } from '../items';
import { Command } from '../structures/command';

export default new Command('copyText', (arg: GenericTreeItem) => {
  vscode.env.clipboard.writeText(arg.description || '');
  vscode.window.showInformationMessage(
    t('copy.copiedText', { TYPE: arg.label }),
  );
});
