import * as vscode from 'vscode';
import { ApplicationCommand } from '../../structures/application.command';

new ApplicationCommand('openEntry', ({ application }) => {
  vscode.env.openExternal(vscode.Uri.parse(application.url));
});
