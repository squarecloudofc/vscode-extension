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

    const dialog = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      openLabel: t('commit.select'),
      title: `Commit - ${app.tag}`,
    });

    if (!dialog) {
      return;
    }

    let [{ path: folder }] = dialog;
    folder = folder.slice(1, folder.length);

    const ig = ignore().add(read(__dirname + '/../../../defaults.ignore'));

    if (existsSync(folder + '/squarecloud.ignore')) {
      ig.add(read(folder + '/squarecloud.ignore'));
    } else if (existsSync(folder + '/.gitignore')) {
      const canIgnore = await vscode.window.showInformationMessage(
        t('commit.useGitIgnore'),
        t('generic.yes'),
        t('generic.no')
      );

      if (canIgnore === t('generic.yes')) {
        ig.add(read(folder + '/.gitignore'));
      }
    }

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('commit.loading'),
      },
      async (progress) => {
        const zipFile = new AdmZip();

        await zipFile.addLocalFolderPromise(folder, {
          filter: (filename) => !ig.ignores(filename),
        });

        await app.commit(zipFile.toBuffer(), `${app.id}.zip`);

        progress.report({ increment: 100 });
        vscode.window.showInformationMessage(t('commit.loaded'));
      }
    );
  }
);

function read(path: string) {
  return readFileSync(path).toString('utf8');
}
