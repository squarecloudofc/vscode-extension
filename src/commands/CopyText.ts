import * as vscode from 'vscode';
import { Command } from '../structures/Command';

export default new Command('copyText', (ctx, arg) => {
  vscode.env.clipboard.writeText(arg.description);
});
