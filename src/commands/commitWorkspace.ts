import { existsSync, readFileSync } from 'fs';
import ignore from 'ignore';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import cacheManager from '../managers/cache.manager';
import configManager from '../managers/config.manager';
import { Command } from '../structures/command';
import AdmZip = require('adm-zip');

new Command('commitWorkspace', async () => {
  const path = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (!path) {
    return;
  }

  const applicationId = configManager.defaultConfig.get('workspaceAppId');
  const application = cacheManager.applications.find(
    (app) => app.id === applicationId
  );

  if (!application) {
    return;
  }

  const ig = ignore().add(read(__dirname + '/../../defaults.ignore'));
  const zipFile = new AdmZip();

  if (existsSync(path + '/squarecloud.ignore')) {
    ig.add(read(path + '/squarecloud.ignore'));
  } else if (existsSync(path + '/.gitignore')) {
    const canIgnore = await vscode.window.showInformationMessage(
      t('commit.useGitIgnore'),
      t('generic.yes'),
      t('generic.no')
    );

    if (canIgnore === t('generic.yes')) {
      ig.add(read(path + '/.gitignore'));
    }
  }

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
        application.commit(zipFile.toBuffer(), 'app.zip', true)
      );

      setTimeout(() => cacheManager.refreshStatus(application.id), 7000);

      vscode.window.showInformationMessage(t('commitWorkspace.loaded'));
      progress.report({ increment: 100 });
      return;
    }
  );
});

function read(path: string) {
  return readFileSync(path).toString('utf8');
}
