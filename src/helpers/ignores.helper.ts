import { existsSync, readFileSync } from 'fs';
import ignore from 'ignore';
import { join } from 'path';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';

export default async function getIgnoreFile(path: string) {
  const ig = ignore().add(read(join(__dirname, '/../../defaults.ignore')));

  if (existsSync(path + '/squarecloud.ignore')) {
    ig.add(read(path + '/squarecloud.ignore'));
  } else if (existsSync(path + '/.gitignore')) {
    const canIgnore = await vscode.window.showInformationMessage(
      t('commit.useGitIgnore'),
      t('generic.yes'),
      t('generic.no'),
    );

    if (canIgnore === t('generic.yes')) {
      ig.add(read(path + '/.gitignore'));
    }
  }

  return ig;
}

export function read(path: string) {
  return readFileSync(path).toString('utf8');
}
