import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { ApplicationItem } from '../../providers';
import { Command } from '../../structures/Command';

export default new Command(
  'showLogs',
  async (ctx, { app }: ApplicationItem) => {
    if (ctx.cache.blocked) {
      ctx.cache.throwBlockError();
      return;
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('logs.loading'),
      },
      async (progress) => {
        const logs = <string>(
          await ctx.cache.blockUntil(() => app.getLogs().catch(() => null))
        );

        progress.report({ increment: 100, message: ` ${t('generic.done')}` });

        if (!logs) {
          vscode.window.showErrorMessage(t('logs.null'));
          return;
        }

        return vscode.window
          .showInformationMessage(t('logs.loaded'), t('logs.button'))
          .then((showLogs) => {
            if (showLogs === t('logs.button')) {
              const outputChannel = vscode.window.createOutputChannel(app.tag);

              outputChannel.append(logs);
              outputChannel.show();
            }
          });
      }
    );
  }
);
