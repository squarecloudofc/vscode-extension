import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { ApplicationItem } from '../../providers';
import { Command } from '../../structures/Command';

export default new Command('copyIdEntry', async (ctx, element: ApplicationItem) => {
  await vscode.env.clipboard.writeText(element?.app?.id);
  vscode.window.showInformationMessage(t('copyId.copied'));
});
