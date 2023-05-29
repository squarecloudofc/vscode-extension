import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import cacheManager from '../../managers/cache.manager';
import { ApplicationCommand } from '../../structures/application.command';

new ApplicationCommand('stopEntry', ({ application }) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('stop.loading'),
    },
    async (progress) => {
      await cacheManager.pauseUntil(() => application.stop());
      setTimeout(() => cacheManager.refreshStatus(application.id), 7000);

      vscode.window.showInformationMessage(t('stop.loaded'));
      progress.report({ increment: 100 });

      return;
    }
  );
});
