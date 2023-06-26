import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import cacheManager from '../../managers/cache.manager';
import configManager from '../../managers/config.manager';
import { Command } from '../../structures/command';

export default new Command('statusBarItem', async () => {
  const workspaceApp = <string>(
    configManager.defaultConfig.get('workspaceAppId')
  );

  const application = cacheManager.applications.find(
    (app) => app.id === workspaceApp,
  );

  const options = {
    commit: {
      label: `$(git-branch) ${t('statusBarItem.commit')}`,
      command: 'commitWorkspace',
    },
    upload: {
      label: `$(cloud-upload) ${t('statusBarItem.upload')}`,
      command: 'uploadWorkspace',
    },
    setApp: {
      label: `$(code) ${t('statusBarItem.setApp')}`,
      command: 'setWorkspaceApp',
    },
    createConfig: {
      label: `$(gear) ${t('statusBarItem.createConfig')}`,
      command: 'createConfig',
    },
    restartApp: {
      label: `$(debug-restart) ${t('command.restart')}`,
      command: 'restartEntry',
    },
    startApp: {
      label: `$(debug-start) ${t('command.start')}`,
      command: 'startEntry',
    },
    stopApp: {
      label: `$(debug-stop) ${t('command.stop')}`,
      command: 'stopEntry',
    },
  };

  const status = await application?.status();

  const selected = await vscode.window.showQuickPick(
    [
      application ? options.commit : options.upload,
      options.setApp,
      options.createConfig,
      ...(application
        ? [
            {
              label: application.tag,
              kind: vscode.QuickPickItemKind.Separator,
            },
            status?.running ? options.stopApp : options.startApp,
            options.restartApp,
          ]
        : []),
    ],
    {
      title: t('statusBarItem.title'),
      placeHolder: t('generic.choose'),
      ignoreFocusOut: true,
    },
  );

  if (!selected) {
    return;
  }

  const { command } = Object.values(options).find(
    ({ label }) => label === selected.label,
  )!;

  vscode.commands.executeCommand(`squarecloud.${command}`, { application });
});
