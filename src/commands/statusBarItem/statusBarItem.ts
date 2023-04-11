import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import cacheManager from '../../managers/cache.manager';
import configManager from '../../managers/config.manager';
import { Command } from '../../structures/command';

new Command('statusBarItem', async () => {
  const workspaceApp = <string>(
    configManager.defaultConfig.get('workspaceAppId')
  );

  const application = cacheManager.applications.find(
    (app) => app.id === workspaceApp
  );

  const options = {
    commit: [`$(git-branch) ${t('statusBarItem.commit')}`, 'commitWorkspace'],
    upload: [`$(cloud-upload) ${t('statusBarItem.upload')}`, 'uploadWorkspace'],
    setApp: [`$(code) ${t('statusBarItem.setApp')}`, 'setWorkspaceApp'],
    createConfig: [
      `$(gear) ${t('statusBarItem.createConfig')}`,
      'createConfig',
    ],
    restartApp: [
      `$(debug-restart) ${t('command.restart')}`,
      'restartWorkspaceApp',
    ],
    startApp: [`$(debug-start) ${t('command.start')}`, 'startWorkspaceApp'],
    stopApp: [`$(debug-stop) ${t('command.stop')}`, 'stopWorkspaceApp'],
  };

  const status = await application?.status();

  const selectedOption = await vscode.window.showQuickPick(
    [
      application ? options.commit[0] : options.upload[0],
      options.setApp[0],
      options.createConfig[0],
      ...(application
        ? [
            status?.running ? options.stopApp[0] : options.startApp[0],
            options.restartApp[0],
          ]
        : []),
    ],
    {
      title: t('statusBarItem.title'),
      placeHolder: t('generic.choose'),
      ignoreFocusOut: true,
    }
  );

  if (!selectedOption) {
    return;
  }

  const commandName = Object.values(options).find(
    (el) => el[0] === selectedOption
  )![1];

  vscode.commands.executeCommand('squarecloud.' + commandName, application);
});
