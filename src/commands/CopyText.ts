import { Command } from '../structures/Command';
import * as vscode from 'vscode';

export default new Command('copyText', (ctx, arg) => {
  vscode.env.clipboard.writeText(arg.description);
});
