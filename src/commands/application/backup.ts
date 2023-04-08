import { AxiosStatic } from 'axios';
import { writeFileSync } from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import cacheManager from '../../managers/cache.manager';
import { ApplicationCommand } from '../../structures/application.command';

const axios: AxiosStatic = require('axios');

new ApplicationCommand('backupEntry', async ({ application }) => {
  if (cacheManager.paused) {
    cacheManager.throwPausedError();
    return;
  }

  const dialog = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    openLabel: t('backup.save'),
    title: `Backup - ${application.tag}`,
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
      const { downloadURL } = (await cacheManager.pauseUntil(() =>
        application.backup()
      ))!;

      const backupBuffer = await axios
        .get(
          `https://registry.squarecloud.app/v1/backup/download/${downloadURL
            .split('/')
            .pop()}`,
          { responseType: 'arraybuffer' }
        )
        .then((r: any) => r.data);

      writeFileSync(
        join(fsPath, `backup-${application.id}.zip`),
        Buffer.from(backupBuffer)
      );

      vscode.window.showInformationMessage(t('backup.loaded'));
      progress.report({ increment: 100 });
      return;
    }
  );
});
