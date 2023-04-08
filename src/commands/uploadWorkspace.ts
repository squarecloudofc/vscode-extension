import { existsSync, readFileSync } from 'fs';
import ignore from 'ignore';
import { join } from 'path';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import createConfigFile from '../helpers/generatefile.helper';
import cacheManager from '../managers/cache.manager';
import apiService from '../services/api.service';
import { Command } from '../structures/command';
import AdmZip = require('adm-zip');
import configManager from '../managers/config.manager';

new Command('uploadWorkspace', async () => {
  const path = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

  if (!path) {
    return;
  }

  if (
    !existsSync(join(path, 'squarecloud.app')) &&
    !existsSync(join(path, 'squarecloud.config'))
  ) {
    const created = await createConfigFile(path);

    if (!created) {
      vscode.window.showErrorMessage(t('uploadWorkspace.createFile'));
      return;
    }
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
      title: t('uploadWorkspace.loading'),
    },
    async (progress) => {
      await zipFile.addLocalFolderPromise(path, {
        filter: (filename) => !ig.ignores(filename),
      });

      const { data } = (await cacheManager.pauseUntil(() =>
        apiService.upload(zipFile.toBuffer())
      ))!;

      await configManager.defaultConfig.update(
        'workspaceAppId',
        data?.id,
        null
      );

      await cacheManager.refreshData();

      vscode.window.showInformationMessage(t('uploadWorkspace.loaded'));
      progress.report({ increment: 100 });
      return;
    }
  );
});

function read(path: string) {
  return readFileSync(path).toString('utf8');
}
