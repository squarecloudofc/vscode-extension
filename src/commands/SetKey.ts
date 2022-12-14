import { Command } from '../classes/Command';
import { env, Uri, window } from 'vscode';

export default new Command('setApiKey', async () => {
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
});
