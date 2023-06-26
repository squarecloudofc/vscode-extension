import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import getIgnoreFile from '../../helpers/ignores.helper';
import cacheManager from '../../managers/cache.manager';
import configManager from '../../managers/config.manager';
import { Command } from '../../structures/command';
import AdmZip = require('adm-zip');

export default new Command('commitWorkspace', async () => {
  const path = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (!path) {
    return;
  }

  const applicationId = configManager.defaultConfig.get('workspaceAppId');
  const application = cacheManager.applications.find(
    (app) => app.id === applicationId,
  );

  if (!application) {
    return;
  }

  const ig = await getIgnoreFile(path);
  const zipFile = new AdmZip();

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('commitWorkspace.loading'),
    },
    async (progress) => {
      await zipFile.addLocalFolderPromise(path, {
        filter: (filename) => !ig.ignores(filename),
      });

      await cacheManager.pauseUntil(() =>
        application.commit(zipFile.toBuffer(), 'app.zip', true),
      );

      setTimeout(() => cacheManager.refreshStatus(application.id), 7000);

      vscode.window.showInformationMessage(t('commitWorkspace.loaded'));
      progress.report({ increment: 100 });
    },
  );
});
