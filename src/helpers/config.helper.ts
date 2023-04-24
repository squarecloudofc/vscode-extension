import { Data, parse, stringify } from 'envfile';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export async function get(path: string): Promise<Data | undefined>;
export async function get(
  path: string,
  key: string
): Promise<string | undefined>;
export async function get(
  path: string,
  key?: string
): Promise<string | Data | undefined> {
  path = getConfigFile(path);

  if (!existsSync(path)) {
    return;
  }

  const buffer = await readFile(path);
  const parsed = parse(buffer.toString('utf-8'));

  return key ? parsed[key] : parsed;
}

export async function set(path: string, obj: { [k: string]: any }) {
  path = getConfigFile(path);

  const oldContent = await get(path);
  const newContent = { ...oldContent, ...obj };
  const parsedContent = Object.fromEntries(
    Object.entries(newContent).filter(([_k, v]) => v)
  );

  await writeFile(path, stringify(parsedContent));
}

export function getConfigFile(path: string) {
  let fileNames = ['squarecloud.config', 'squarecloud.app'];

  if (fileNames.some((file) => path.endsWith(file))) {
    return path;
  }

  const fileName =
    fileNames.filter((file) => existsSync(join(path, file)))[0] ||
    'squarecloud.app';

  return join(path, fileName);
}
