import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import cacheManager from '../../managers/cache.manager';
import { Application } from '../../structures/application';
import { Command } from '../../structures/command';

new Command('startWorkspaceApp', async (application?: Application) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  if (!application) {
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('start.loading'),
    },
    async (progress) => {
      await cacheManager.pauseUntil(() => application.start());
      setTimeout(() => cacheManager.refreshStatus(application.id), 7000);

      vscode.window.showInformationMessage(t('start.loaded'));
      progress.report({ increment: 100 });

      return;
    }
  );
});
