import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

export function getDirectoryFiles(
  path: string,
  fileExtensions = ['.ts', '.js']
) {
  path = join(__dirname, '..', path);

  if (!existsSync(path)) {
    return [];
  }

  const rawFiles = readdirSync(path, { withFileTypes: true });
  let files: string[] = [];

  for (const file of rawFiles) {
    if (file.isDirectory()) {
      files = [
        ...files,
        ...getDirectoryFiles(join(path, file.name), fileExtensions),
      ];
    }

    if (fileExtensions.some((e) => file.name.endsWith(e))) {
      files.push(join(path, file.name));
    }
  }

  return files;
}

export function getIconPaths(iconName: string) {
  const pathByTheme = (theme: 'dark' | 'light') => {
    return join(__dirname, '..', '..', 'resources', theme, iconName);
  };

  return {
    light: pathByTheme('light'),
    dark: pathByTheme('dark'),
  };
}
