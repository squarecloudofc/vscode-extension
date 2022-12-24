import { Command } from '../../structures/Command';
import { ApplicationItem } from '../../providers';
import { t } from 'vscode-ext-localisation';
import * as vscode from 'vscode';

export default new Command(
  'deleteEntry',
  async (ctx, { app }: ApplicationItem) => {
    if (ctx.cache.blocked) {
      ctx.cache.handleBlock();
      return;
    }

    const confirmDelete = await vscode.window.showInputBox({
      placeHolder: app.tag,
      title: t('delete.confirm'),
    });

    if (confirmDelete !== app.tag) {
      vscode.window.showInformationMessage(t('delete.cancelled'));
      return;
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('delete.loading'),
      },
      async (progress) => {
        await ctx.cache.blockUntil(() => app.delete());

        setTimeout(() => ctx.cache.refresh(), 2000);

        vscode.window.showInformationMessage(t('delete.loaded'));
        progress.report({ increment: 100 });

        return;
      }
    );
  }
);
