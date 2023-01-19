import AdmZip = require('adm-zip');
import { existsSync, readFileSync } from 'fs';
import ignore from 'ignore';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { Command } from '../structures/Command';
import createConfigFile from '../utils/createConfigFile';

export default new Command('setWorkspaceApp', async (ctx, arg) => {
  const workspace = vscode.workspace.workspaceFolders?.[0];

  if (!workspace) {
    return;
  }

  await ctx.cache.refresh(true);

  const app = await vscode.window.showQuickPick<vscode.QuickPickItem>(
    [
      {
        label: t('setWorkspaceApp.newApp'),
        detail: `$(cloud-upload) ${t('setWorkspaceApp.uploadText')}`,
      },
      {
        label: t('setWorkspaceApp.yourApps'),
        kind: -1,
        alwaysShow: true,
      },
      ...ctx.cache.applications.map((app) => ({
        label: app.tag,
        detail: `$(suggest-more-info) ${app.id}`,
      })),
    ],
    {
      placeHolder: t('generic.choose'),
      title: t('setWorkspaceApp.choose'),
      ignoreFocusOut: true,
    }
  );

  if (!app) {
    return;
  }

  if (app.detail?.endsWith(t('setWorkspaceApp.uploadText'))) {
    const confirmUpload = await vscode.window.showQuickPick(
      [t('generic.yes'), t('generic.no')],
      {
        placeHolder: t('generic.choose'),
        title: t('uploadWorkspace.confirm'),
      }
    );

    if (confirmUpload !== t('generic.yes')) {
      vscode.window.showInformationMessage(t('uploadWorkspace.canceled'));
      return;
    }

    const path = workspace.uri.fsPath;

    if (
      !existsSync(path + '/squarecloud.app') &&
      !existsSync(path + '/squarecloud.config')
    ) {
      const confirmConfig = await vscode.window.showQuickPick(
        [t('generic.yes'), t('generic.no')],
        {
          placeHolder: t('generic.choose'),
          title: t('setWorkspaceApp.confirmConfig'),
        }
      );

      if (confirmConfig !== t('generic.yes')) {
        return;
      }

      const createdConfig = await createConfigFile(path, ctx);

      if (!createdConfig) {
        return;
      }
    }

    ctx.utilBarItem.setCommand();

    const ig = ignore().add(read(__dirname + '/../../defaults.ignore'));

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
        const zipFile = new AdmZip();

        await zipFile.addLocalFolderPromise(workspace.uri.fsPath, {
          filter: (filename) => !ig.ignores(filename),
        });

        const appId = await ctx.cache.api.api
          ?.uploadApplication(zipFile.toBuffer())
          .catch(() => 'err');

        if (appId === 'err') {
          progress.report({ increment: 100 });
          vscode.window.showErrorMessage(t('uploadWorkspace.error'));
        } else {
          await ctx.config.update('workspaceAppId', appId, null);
          progress.report({ increment: 100 });
          vscode.window.showInformationMessage(t('uploadWorkspace.loaded'));

          setTimeout(async () => {
            await ctx.cache.refresh(true);
            vscode.window.showInformationMessage(
              t('uploadWorkspace.configured')
            );
          }, 7000);
        }
      }
    );

    return;
  }

  await ctx.config.update('workspaceAppId', app.detail?.split(' ')[1], null);
  vscode.window.showInformationMessage(t('setWorkspaceApp.success'));
});

function read(path: string) {
  return readFileSync(path).toString('utf8');
}
