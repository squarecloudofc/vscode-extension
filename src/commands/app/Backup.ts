import { writeFileSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { ApplicationItem } from '../../providers';
import { Command } from '../../structures/Command';

const axios = require('axios');

export default new Command(
  'backupEntry',
  async (ctx, { app }: ApplicationItem) => {
    if (ctx.cache.blocked) {
      ctx.cache.throwBlockError();
      return;
    }

    const dialog = await vscode.window.showOpenDialog({
      canSelectFolders: true,
      openLabel: t('backup.save'),
      title: `Backup - ${app.tag}`,
    });

    if (!dialog) {
      return;
    }

    let [{ fsPath }] = dialog;

    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: t('backup.loading'),
      },
      async (progress) => {
        const backupURL = await ctx.cache.blockUntil(() => app.backup());

        const backupBuffer = await axios
          .get(
            `https://registry.squarecloud.app/v1/backup/download/${backupURL
              .split('/')
              .pop()}`,
            { responseType: 'arraybuffer' }
          )
          .then((r: any) => r.data);

        writeFileSync(join(fsPath, `backup-${app.id}.zip`), Buffer.from(backupBuffer));

        vscode.window.showInformationMessage(t('backup.loaded'));
        progress.report({ increment: 100 });

        return;
      }
    );
  }
);
