/* eslint-disable @typescript-eslint/naming-convention */

import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { Command } from '../structures/command';

new Command('copyText', (_ctx, arg) => {
  vscode.env.clipboard.writeText(arg.description);
  vscode.window.showInformationMessage(
    t('copy.copiedText', { TYPE: arg.label })
  );
});
