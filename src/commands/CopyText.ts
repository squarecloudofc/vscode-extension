import { Command } from '../structures/Command';
import vscode from 'vscode';

export default new Command('copyText', (ctx, arg) => {
  vscode.env.clipboard.writeText(arg.description);
});
