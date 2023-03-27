import SquareCloudAPI from '@squarecloud/api';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { Command } from '../structures/Command';

export default new Command('setApiKey', async (ctx) => {
  const apiKey = await vscode.window.showInputBox({
    title: t('setApiKey.apiKey'),
    placeHolder: t('generic.paste'),
    ignoreFocusOut: true,
  });

  if (!apiKey) {
    return;
  }

  const testKey = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('setApiKey.testing'),
    },
    async () => {
      return await new SquareCloudAPI(apiKey).getUser().catch(() => undefined);
    }
  );

  if (!testKey) {
    vscode.window
      .showErrorMessage(t('setApiKey.invalid'), t('command.setApiKey'))
      .then((value) =>
        value === t('command.setApiKey')
          ? vscode.commands.executeCommand('squarecloud.setApiKey')
          : null
      );

    return;
  }

  await ctx.config.update('apiKey', apiKey, true);
  ctx.cache.refresh();

  vscode.window.showInformationMessage(t('setApiKey.success'));
});
