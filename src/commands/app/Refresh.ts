import { Command } from '../../structures/Command';
import { ApplicationItem } from '../../providers';
import { t } from 'vscode-ext-localisation';
import * as vscode from 'vscode';

export default new Command(
  'refreshEntry',
  (ctx, { app }: ApplicationItem) => {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: t('generic.refreshing'),
      },
      async (progress) => {
        await ctx.cache.refreshStatus(app.id);

        progress.report({ increment: 100 });
      }
    );
  }
);
