import { getVscodeLang, loadTranslations } from 'vscode-ext-localisation';
import CommandManager from './CommandManager';
import { existsSync, readdirSync } from 'fs';
import * as vscode from 'vscode';
import { join } from 'path';

export async function activate(context: vscode.ExtensionContext) {
	console.log('Loading extension...')

  loadTranslations(
    getVscodeLang(process.env.VSCODE_NLS_CONFIG),
    context.extensionPath
  );

	console.log('Translations loaded!');

  for await (const file of getAllFiles(join(__dirname, 'commands'))) {
    await import(file);
  }

	console.log('Commands loaded!');

  context.subscriptions.push(...CommandManager.commands);
  console.log('Extension loaded!');
}

export function deactivate() {}

export function getAllFiles(path: string) {
  if (!existsSync(path)) {
    return [];
  }

  const rawFiles = readdirSync(path, { withFileTypes: true });
  let files: string[] = [];

  for (const file of rawFiles) {
    if (file.isDirectory()) {
      files = [...files, ...getAllFiles(`${path}/${file.name}`)];
    }

    if (!file.name.endsWith('.ts')) {
      continue;
    }

    files.push(file.name);
  }

  return files;
}
