import { Command } from '../../structures/Command';
import { ApplicationItem } from '../../providers';
import { t } from 'vscode-ext-localisation';
import vscode from 'vscode';

export default new Command('startEntry', (ctx, { app }: ApplicationItem) => {
  if (ctx.cache.blocked) {
    ctx.cache.handleBlock();
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
