import * as vscode from 'vscode';
import { ApplicationCommand } from '../../structures/application.command';
import cacheManager from '../../managers/cache.manager';
import { t } from 'vscode-ext-localisation';

new ApplicationCommand('showLogs', ({ application }) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('logs.loading'),
    },
    async (progress) => {
      const { logs } =
        (await cacheManager.pauseUntil(() =>
          application.logs().catch(() => null)
        )) || {};

      progress.report({ increment: 100, message: ` ${t('generic.done')}` });

      if (!logs) {
        vscode.window.showErrorMessage(t('logs.null'));
        return;
      }

      return vscode.window
        .showInformationMessage(t('logs.loaded'), t('logs.button'))
        .then((showLogs) => {
          if (showLogs === t('logs.button')) {
            const outputChannel = vscode.window.createOutputChannel(
              application.tag,
              'ansi'
            );

            outputChannel.append(logs);
            outputChannel.show();
          }
        });
    }
  );
});
