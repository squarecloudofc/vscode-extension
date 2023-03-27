import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export default function getAllFiles(path: string, fileExtensions?: string[]) {
  if (!existsSync(path)) {
    return [];
  }

  const rawFiles = readdirSync(path, { withFileTypes: true });
  let files: string[] = [];

  for (const file of rawFiles) {
    if (file.isDirectory()) {
      files = [...files, ...getAllFiles(join(path, file.name), fileExtensions)];
    }

    if (fileExtensions && !fileExtensions.some((e) => file.name.endsWith(e))) {
      continue;
    }

    files.push(join(path, file.name));
  }

  return files;
}
