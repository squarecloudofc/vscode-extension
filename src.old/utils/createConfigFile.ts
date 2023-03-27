import { existsSync, writeFileSync } from 'fs';
import * as vscode from 'vscode';
import { t } from 'vscode-ext-localisation';
import { SquareCloud } from '../structures/SquareCloud';

export default async function createConfigFile(path: string, ctx: SquareCloud) {
  if (!existsSync(path)) {
    return;
  }

  let fieldsString = '';

  const addField = (name: string, value: string) => {
    fieldsString += `${name}=${value.trim()}\n`;
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
    {
      type: 'required',
      title: t('createConfig.prompt.displayName'),
      placeHolder: t('generic.type'),
    },
    {
      type: 'optional',
      field: t('createConfig.prompt.avatar.subs'),
      title: t('createConfig.prompt.avatar.title'),
      placeHolder: t('generic.paste'),
      validateInput: (value) => {
        return /^https?:\/\/.+\.(?:jpe?g|gif|png|webp)(?:\?[^#]*)?(?:#.*)?$/i.test(
          value
        )
          ? undefined
          : {
              message: t('createConfig.prompt.avatar.invalid'),
              severity: vscode.InputBoxValidationSeverity.Error,
            };
      },
    },
    {
      type: 'optional',
      field: t('createConfig.prompt.description.subs'),
      title: t('createConfig.prompt.description.title'),
      placeHolder: t('generic.type'),
    },
    {
      type: 'required',
      title: t('createConfig.prompt.main.title'),
      placeHolder: t('generic.type'),
      validateInput: (value) => {
        return existsSync(path + '/' + value) &&
          ['.ts', '.js', '.jar', '.py', '.go'].some((ext) =>
            value.endsWith(ext)
          )
          ? undefined
          : {
              message: t('createConfig.prompt.main.invalid'),
              severity: vscode.InputBoxValidationSeverity.Warning,
            };
      },
    },
    {
      type: 'required',
      title: t('createConfig.prompt.memory.title', {
        max: available ? `(Max: ${available}MB)` : '',
      }),
      placeHolder: t('generic.type'),
      validateInput: (value: string | number) => {
        const minValue = isWebsite ? 512 : 100;
        value = Number(value);

        return isNaN(value) ||
          (available && value > available) ||
          value < ((isWebsite && 512) || 100)
          ? {
              message: t('createConfig.prompt.memory.invalid', {
                minValue: `${minValue}`,
              }),
              severity: vscode.InputBoxValidationSeverity.Error,
            }
          : undefined;
      },
    },
    {
      type: 'pick',
      title: t('createConfig.prompt.version'),
      placeHolder: t('generic.choose'),
      items: ['Recommended', 'Latest'],
    },
    ...(isWebsite
      ? <Prompt[]>[
          {
            type: 'required',
            title: t('createConfig.prompt.subdomain.title'),
            placeHolder:
              t('generic.type') + ' (ex.: customdomain.squareweb.app)',
          },
          {
            type: 'optional',
            field: t('createConfig.prompt.start.subs'),
            title: t('createConfig.prompt.start.title'),
            placeHolder: t('generic.type'),
          },
        ]
      : []),
  ];

  const required: (string | undefined)[] = [];
  const optional: (string | undefined)[] = [];

  for (const prompt of prompts) {
    const response = await askPrompt(prompt);

    if (prompt.type === 'required' && !response) {
      return;
    }

    prompt.type === 'required' || prompt.type === 'pick'
      ? required.push(response)
      : optional.push(response);
  }

  const [displayName, mainFile, ramMemory, version, subDomain] = required;
  const [avatar, description, startCommand] = optional;

  console.log(required, optional);

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

  writeFileSync(path + '/squarecloud.app', fieldsString);
  return true;
}

type Prompt =
  | (OptionalArgs & { type: 'optional' })
  | (InputArgs & { type: 'required' })
  | (PickArgs & { type: 'pick' });

type OptionalArgs = {
  field: string;
  title: string;
  placeHolder: string;
  validateInput?: ValidateInput;
};
type InputArgs = {
  title: string;
  placeHolder: string;
  validateInput?: ValidateInput;
};
type PickArgs = { title: string; placeHolder: string; items: string[] };
type ValidateInput = vscode.InputBoxOptions['validateInput'];

function askPrompt(prompt: Prompt) {
  switch (prompt.type) {
    case 'optional':
      return showOptionalInput(prompt);
    case 'required':
      return showInput(prompt);
    case 'pick':
      return showPick(prompt);
  }
}

function showInput({ title, placeHolder, validateInput }: InputArgs) {
  validateInput =
    validateInput ||
    ((value) =>
      value.trim().length
        ? undefined
        : {
            message: t('createConfig.nothingHere'),
            severity: vscode.InputBoxValidationSeverity.Error,
          });

  return vscode.window.showInputBox({
    title,
    placeHolder,
    validateInput,
    ignoreFocusOut: true,
  });
}

function showPick({ items, placeHolder, title }: PickArgs) {
  return vscode.window.showQuickPick(items, { title, placeHolder });
}

function showOptionalInput({
  field,
  placeHolder,
  title,
  validateInput,
}: OptionalArgs) {
  return vscode.window
    .showQuickPick([t('generic.yes'), t('generic.no')], {
      title: t('createConfig.optional', { field }),
      placeHolder: t('generic.choose'),
    })
    .then((value) => {
      return value === t('generic.yes')
        ? showInput({ title, placeHolder, validateInput })
        : undefined;
    });
}
