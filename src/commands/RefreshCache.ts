import { Command } from '../structures/Command';
import { t } from 'vscode-ext-localisation';
import * as vscode from 'vscode';

export default new Command('refreshCache', async (ctx) => {
  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      title: t('generic.refreshing'),
    },
    async (progress) => {
      await ctx.cache.refresh();

      progress.report({ increment: 100 });
    }
  );
});
