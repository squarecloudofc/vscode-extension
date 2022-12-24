import { Command } from '../structures/Command';
import { t } from 'vscode-ext-localisation';
import { env, Uri, window } from 'vscode';

export default new Command('setApiKey', async (ctx) => {
  const hasKey = await window.showQuickPick(
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
    const tutorialButton = await window.showInformationMessage(
      t('setApiKey.tutorial.label'),
      t('setApiKey.tutorial.button')
    );

    if (tutorialButton === t('setApiKey.tutorial.button')) {
      env.openExternal(Uri.parse('https://squarecloud.app/dashboard/me'));
    }

    return;
  }

  const apiKey = await window.showInputBox({
    title: t('setApiKey.apiKey.title'),
    placeHolder: t('setApiKey.apiKey.placeHolder'),
  });

  if (!apiKey) {
    return;
  }

  await ctx.config.update('apiKey', apiKey, true);
  ctx.cache.refresh();

  window.showInformationMessage(t('setApiKey.success'));
});
