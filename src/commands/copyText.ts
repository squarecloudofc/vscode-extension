/* eslint-disable @typescript-eslint/naming-convention */

import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { Command } from '../structures/command';
import { GenericTreeItem } from '../items';

new Command('copyText', (arg: GenericTreeItem) => {
  vscode.env.clipboard.writeText(arg.description || '');
  vscode.window.showInformationMessage(
    t('copy.copiedText', { TYPE: arg.label })
  );
});
