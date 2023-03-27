/* eslint-disable @typescript-eslint/naming-convention */
import * as AdmZip from 'adm-zip';
import { existsSync, readFileSync } from 'fs';
import ignore from 'ignore';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { ApplicationItem } from '../../providers';
import { Command } from '../../structures/Command';

export default new Command(
  'commitEntry',
  async (ctx, { app }: ApplicationItem) => {
    if (ctx.cache.blocked) {
      ctx.cache.throwBlockError();
      return;
    }

    const fileOrFolder = await vscode.window.showQuickPick(
      [t('generic.file'), t('generic.folder')],
      {
        title: t('commit.fileOrFolder'),
        placeHolder: t('generic.choose'),
      }
    );

    if (!fileOrFolder) {
      return;
    }

    const files = await vscode.window.showOpenDialog({
      canSelectMany: fileOrFolder === t('generic.file'),
      canSelectFiles: fileOrFolder === t('generic.file'),
      canSelectFolders: fileOrFolder === t('generic.folder'),
      openLabel: t('commit.select', { TYPE: fileOrFolder.toLowerCase() }),
      title: `Commit - ${app.tag}`,
    });

    if (!files) {
      return;
    }

    const ig = ignore().add(read(__dirname + '/../../../defaults.ignore'));
    const zipFile = new AdmZip();

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('commit.loading'),
      },
      async (progress) => {
        if (fileOrFolder === t('generic.file')) {
          for (let { path } of files) {
            path = path.slice(1);

            zipFile.addLocalFile(path);
          }
        } else {
          let [{ path }] = files;
          path = path.slice(1);

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

          await zipFile.addLocalFolderPromise(path, {
            zipPath: path.split('/').pop() + '/',
            filter: (filename) => !ig.ignores(filename),
          });
        }

        await app.commit(zipFile.toBuffer(), `${app.id}.zip`);
        await app.restart();

        setTimeout(() => ctx.cache.refreshStatus(app.id), 7000);

        progress.report({ increment: 100 });
        vscode.window.showInformationMessage(t('commit.loaded'));
      }
    );
  }
);

function read(path: string) {
  return readFileSync(path).toString('utf8');
}
