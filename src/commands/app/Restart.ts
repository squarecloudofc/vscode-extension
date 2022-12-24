import { Command } from '../../structures/Command';
import { ApplicationItem } from '../../providers';
import { t } from 'vscode-ext-localisation';
import * as vscode from 'vscode';

export default new Command('restartEntry', (ctx, { app }: ApplicationItem) => {
  if (ctx.cache.blocked) {
    ctx.cache.handleBlock();
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('restart.loading'),
    },
    async (progress) => {
      await ctx.cache.blockUntil(() => app.restart());

      setTimeout(() => ctx.cache.refreshStatus(app.id), 2000);

      vscode.window.showInformationMessage(t('restart.loaded'));
      progress.report({ increment: 100 });

      return;
    }
  );
});