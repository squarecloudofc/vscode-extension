import { Command } from '../structures/Command';
import SquareCloudAPI from '@squarecloud/api';
import { t } from 'vscode-ext-localisation';
import vscode from 'vscode';

export default new Command('setApiKey', async (ctx) => {
  const hasKey = await vscode.window.showQuickPick(
    [t('generic.yes'), t('generic.no')],
    {
      title: t('setApiKey.hasKey.title'),
      placeHolder: t('setApiKey.hasKey.placeHolder'),
    }
  );

  if (!hasKey) {
    return;
  }

  if (hasKey === t('generic.no')) {
    const tutorialButton = await vscode.window.showInformationMessage(
      t('setApiKey.tutorial.label'),
      t('setApiKey.tutorial.button')
    );

    if (tutorialButton === t('setApiKey.tutorial.button')) {
      vscode.env.openExternal(
        vscode.Uri.parse('https://squarecloud.app/dashboard/me')
      );
    }

    return;
  }

  const apiKey = await vscode.window.showInputBox({
    title: t('setApiKey.apiKey.title'),
    placeHolder: t('setApiKey.apiKey.placeHolder'),
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
