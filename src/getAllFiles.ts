import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export function getAllFiles(path: string) {
  if (!existsSync(path)) {
    return [];
  }

  const rawFiles = readdirSync(path, { withFileTypes: true });
  let files: string[] = [];

  for (const file of rawFiles) {
    if (file.isDirectory()) {
      files = [...files, ...getAllFiles(join(path, file.name))];
    }

    if (!file.name.endsWith('.ts') && !file.name.endsWith('.js')) {
      continue;
    }

    files.push(join(path, file.name));
  }

  return files;
}
