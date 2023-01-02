import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { ApplicationItem } from '../../providers';
import { Command } from '../../structures/Command';

export default new Command('startEntry', (ctx, { app }: ApplicationItem) => {
  if (ctx.cache.blocked) {
    ctx.cache.throwBlockError();
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('start.loading'),
    },
    async (progress) => {
      await ctx.cache.blockUntil(() => app.start());

      setTimeout(() => ctx.cache.refreshStatus(app.id), 5000);

      vscode.window.showInformationMessage(t('start.loaded'));
      progress.report({ increment: 100 });

      return;
    }
  );
});
