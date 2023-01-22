import AdmZip = require('adm-zip');
import { existsSync, readFileSync } from 'fs';
import ignore from 'ignore';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { Command } from '../structures/Command';

export default new Command('commitWorkspace', async (ctx, arg) => {
  if (ctx.cache.blocked) {
    ctx.cache.throwBlockError();
    return;
  }

  const workspace = vscode.workspace.workspaceFolders?.[0];

  if (!workspace) {
    return;
  }

  const appId = await ctx.config.get('workspaceAppId');
  const app = ctx.cache.applications.find((app) => app.id === appId);

  if (!app) {
    return;
  }

  if (!ctx.config.get('bypassCommitConfirm')) {
    const confirmCommit = await vscode.window.showQuickPick(
      [t('generic.yes'), t('generic.no')],
      {
        placeHolder: t('generic.choose'),
        title: t('commitWorkspace.confirm'),
      }
    );

    if (confirmCommit !== t('generic.yes')) {
      vscode.window.showInformationMessage(t('commitWorkspace.canceled'));
      return;
    }

    const saveConfirm = await vscode.window.showQuickPick(
      [t('generic.yes'), t('generic.no')],
      {
        placeHolder: t('generic.choose'),
        title: t('commitWorkspace.saveConfirm'),
      }
    );

    if (saveConfirm === t('generic.yes')) {
      await ctx.config.update('bypassCommitConfirm', true, true);
    }
  }

  const currentCommand = ctx.utilBarItem.barItem.command;
  ctx.utilBarItem.setCommand();

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: t('commit.loading'),
    },
    async (progress) => {
      const path = workspace.uri.fsPath.slice(1);
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

      const zipFile = new AdmZip();

      await zipFile.addLocalFolderPromise(workspace.uri.fsPath, {
        filter: (filename) => !ig.ignores(filename),
      });

      const success = await app
        .commit(zipFile.toBuffer(), 'app.zip')
        .catch(() => 'err');

      progress.report({ increment: 100 });

      ctx.utilBarItem.setCommand(
        typeof currentCommand === 'string'
          ? currentCommand
          : currentCommand?.command
      );

      if (success === 'err') {
        vscode.window.showErrorMessage(t('commit.error'));
      } else {
        vscode.window.showInformationMessage(t('commit.loaded'));
      }
    }
  );
});

function read(path: string) {
  return readFileSync(path).toString('utf8');
}
