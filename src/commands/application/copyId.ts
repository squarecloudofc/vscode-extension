import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { ApplicationCommand } from '../../structures/application.command';

new ApplicationCommand('copyIdEntry', async (_ctx, { application }) => {
  await vscode.env.clipboard.writeText(application.id);
  vscode.window.showInformationMessage(t('copyId.copied'));
});
