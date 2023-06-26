import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import cacheManager from '../../managers/cache.manager';
import { ApplicationCommand } from '../../structures/application.command';

export default new ApplicationCommand('restartEntry', ({ application }) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('restart.loading'),
    },
    async (progress) => {
      await cacheManager.pauseUntil(() => application.restart());
      setTimeout(() => cacheManager.refreshStatus(application.id), 7000);

      vscode.window.showInformationMessage(t('restart.loaded'));
      progress.report({ increment: 100 });
    },
  );
});
