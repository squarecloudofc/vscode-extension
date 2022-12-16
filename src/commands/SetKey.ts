import { Command } from '../classes/Command';
import { env, Uri, window } from 'vscode';

export default new Command('setApiKey', async (ctx) => {
  const hasKey = await window.showQuickPick(['Yes', 'No'], {
    title: 'Do you have your API key already?',
    placeHolder: 'Choose an option...',
  });

  if (!hasKey) {
    return;
  }

  if (hasKey === 'No') {
    const tutorialButton = await window.showInformationMessage(
      'First open the "SquareCloud Dashboard", then go to "My Account" and finally click "Regenerate API/CLI KEY".',
      'Open Dashboard'
    );

    if (tutorialButton === 'Open Dashboard') {
      env.openExternal(Uri.parse('https://squarecloud.app/dashboard'));
    }

    return;
  }

  const apiKey = await window.showInputBox({
    placeHolder: 'Paste here...',
    title: 'Enter your API key.',
  });

  console.log(apiKey);

  if (!apiKey) {
    return;
  }

  await ctx.config.update('apiKey', apiKey, true);

  window.showInformationMessage(
    'Your API key has been successfuly registered!'
  );
});
