/* eslint-disable @typescript-eslint/naming-convention */
import { writeFileSync } from 'fs';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { Command } from '../structures/Command';

export default new Command('createConfig', async (ctx, arg) => {
  const path = arg
    ? <string>arg.fsPath
    : vscode.workspace.workspaceFolders?.[0].uri.fsPath + '/squarecloud.config';

  let fileText = '';

  if (!path) {
    return;
  }

  const addField = (name: string, value: string) => {
    fileText += `${name}=${value.trim()}\n`;
  };

  const addFields = (...fields: [string, string | undefined][]) => {
    fields.map(([name, value]) => (value ? addField(name, value) : null));
  };

  const botOrSite = await vscode.window.showQuickPick(['Bot', 'Website'], {
    ignoreFocusOut: true,
    placeHolder: t('generic.choose'),
    title: t('createConfig.botOrSite'),
  });

  if (!botOrSite) {
    return;
  }

  const { available } = ctx.cache.user?.plan.memory || {};
  const isWebsite = botOrSite === 'Website';

  const prompts: Prompt[] = [
    [true, t('createConfig.prompt.displayName'), t('generic.type')],
    [
      t('createConfig.prompt.avatar.subs'),
      t('createConfig.prompt.avatar.title'),
      t('generic.paste'),
      (value) => {
        return /^https?:\/\/.+\.(?:jpe?g|gif|png|webp)(?:\?[^#]*)?(?:#.*)?$/i.test(
          value
        )
          ? undefined
          : {
              message: t('createConfig.prompt.avatar.invalid'),
              severity: vscode.InputBoxValidationSeverity.Error,
            };
      },
    ],
    [
      t('createConfig.prompt.description.subs'),
      t('createConfig.prompt.description.title'),
      t('generic.type'),
    ],
    [true, t('createConfig.prompt.main'), t('generic.type')],
    [
      true,
      t('createConfig.prompt.memory.title', {
        MAX: available ? `(Max: ${available}MB)` : '',
      }),
      t('generic.type'),
      (value: string | number) => {
        const MIN_VALUE = isWebsite ? 512 : 100;
        value = Number(value);

        return isNaN(value) ||
          (available && value > available) ||
          value < ((isWebsite && 512) || 100)
          ? {
              message: t('createConfig.prompt.memory.invalid', {
                MIN_VALUE: `${MIN_VALUE}`,
              }),
              severity: vscode.InputBoxValidationSeverity.Error,
            }
          : undefined;
      },
    ],
    [
      false,
      t('createConfig.prompt.version'),
      t('generic.choose'),
      'Recommended',
      'Latest',
    ],
    ...(isWebsite
      ? <Prompt[]>[
          [
            true,
            t('createConfig.prompt.subdomain'),
            t('generic.type') + ' (ex.: customdomain.squareweb.app)',
          ],
          [
            t('createConfig.prompt.start.subs'),
            t('createConfig.prompt.start.title'),
            t('generic.type'),
          ],
        ]
      : []),
  ];

  const required: (string | undefined)[] = [];
  const optional: (string | undefined)[] = [];

  for (const prompt of prompts) {
    switch (prompt[0]) {
      case true:
        required.push(await showInput(...(<InputArgs>prompt.slice(1))));
        continue;
      case false:
        required.push(await showPick(...(<PickArgs>prompt.slice(1))));
        continue;
      default:
        optional.push(await showOptionalInput(...prompt));
        continue;
    }
  }

  const [displayName, mainFile, ramMemory, version, subDomain] = required;
  const [avatar, description, startCommand] = optional;

  addFields(
    ['DISPLAY_NAME', displayName],
    ['DESCRIPTION', description],
    ['AVATAR', avatar],
    ['MAIN', mainFile],
    ['MEMORY', ramMemory],
    ['VERSION', version?.toLowerCase()],
    ['SUBDOMAIN', subDomain],
    ['START', startCommand]
  );

  writeFileSync(path, fileText);
});

type Prompt = OptionalArgs | [true, ...InputArgs] | [false, ...PickArgs];

type OptionalArgs = Parameters<typeof showOptionalInput>;
type InputArgs = Parameters<typeof showInput>;
type PickArgs = Parameters<typeof showPick>;

function showInput(
  title: string,
  placeHolder: string,
  validateInput: vscode.InputBoxOptions['validateInput'] = (value) =>
    value.trim().length
      ? undefined
      : {
          message: t('createConfig.nothingHere'),
          severity: vscode.InputBoxValidationSeverity.Error,
        }
) {
  return vscode.window.showInputBox({
    title,
    placeHolder,
    validateInput,
    ignoreFocusOut: true,
  });
}

function showPick(title: string, placeHolder: string, ...items: string[]) {
  return vscode.window.showQuickPick(items, { title, placeHolder });
}

function showOptionalInput(
  FIELD: string,
  title: string,
  placeHolder: string,
  validateInput?: vscode.InputBoxOptions['validateInput']
) {
  return vscode.window
    .showQuickPick([t('generic.yes'), t('generic.no')], {
      title: t('createConfig.optional', { FIELD }),
      placeHolder: t('generic.choose'),
    })
    .then((value) => {
      return value === t('generic.yes')
        ? showInput(title, placeHolder, validateInput)
        : undefined;
    });
}
