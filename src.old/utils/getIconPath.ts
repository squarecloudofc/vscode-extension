import * as path from 'path';

export default function getIconPath(iconName: string) {
  return {
    light: path.join(__dirname, '..', '..', 'resources', 'light', iconName),
    dark: path.join(__dirname, '..', '..', 'resources', 'dark', iconName),
  };
}
