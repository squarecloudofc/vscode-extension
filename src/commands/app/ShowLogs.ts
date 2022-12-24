import { Command } from '../../structures/Command';
import { ApplicationItem } from '../../providers';
import { t } from 'vscode-ext-localisation';
import * as vscode from 'vscode';

export default new Command(
  'showLogs',
  async (ctx, { app }: ApplicationItem) => {
    if (ctx.cache.blocked) {
      ctx.cache.handleBlock();
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
              const panel = vscode.window.createWebviewPanel(
                'logs-view',
                `Logs - ${app.tag}`,
                vscode.ViewColumn.One,
                {
                  enableScripts: true,
                }
              );

              panel.webview.html = `
                <body><pre><code>${logs}</code></pre></body>
              `;

              panel.reveal();
            }
          });
      }
    );
  }
);
