import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { ApplicationItem } from '../../providers';
import { Command } from '../../structures/Command';

export default new Command(
  'deleteEntry',
  async (ctx, { app }: ApplicationItem) => {
    if (ctx.cache.blocked) {
      ctx.cache.throwBlockError();
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

        setTimeout(() => ctx.cache.refresh(), 7000);

        vscode.window
          .showInformationMessage(t('delete.loaded'), 'Download Backup')
          .then(async (value) => {
            if (value === 'Download Backup') {
              const backupURL = await ctx.cache.blockUntil(() => app.backup());

              vscode.env.openExternal(vscode.Uri.parse(backupURL));
            }
          });

        progress.report({ increment: 100 });

        return;
      }
    );
  }
);
