import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { ApplicationItem } from '../../providers';
import { Command } from '../../structures/Command';

export default new Command('stopEntry', (ctx, { app }: ApplicationItem) => {
  if (ctx.cache.blocked) {
    ctx.cache.throwBlockError();
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('stop.loading'),
    },
    async (progress) => {
      await ctx.cache.blockUntil(() => app.stop());

      setTimeout(() => ctx.cache.refreshStatus(app.id), 7000);

      vscode.window.showInformationMessage(t('stop.loaded'));
      progress.report({ increment: 100 });

      return;
    }
  );
});
