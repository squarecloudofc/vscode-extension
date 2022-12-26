import { Command } from '../../structures/Command';
import { ApplicationItem } from '../../providers';
import { t } from 'vscode-ext-localisation';
import vscode from 'vscode';

export default new Command('restartEntry', (ctx, { app }: ApplicationItem) => {
  if (ctx.cache.blocked) {
    ctx.cache.throwBlockError();
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('restart.loading'),
    },
    async (progress) => {
      await ctx.cache.blockUntil(() => app.restart());

      setTimeout(() => ctx.cache.refreshStatus(app.id), 5000);

      vscode.window.showInformationMessage(t('restart.loaded'));
      progress.report({ increment: 100 });

      return;
    }
  );
});
