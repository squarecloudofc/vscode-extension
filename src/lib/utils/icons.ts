import { join } from "node:path";
import { Uri } from "vscode";

export function getIcons(iconName: string) {
  const pathByTheme = (theme: "dark" | "light") => {
    return Uri.file(join(__dirname, "..", "resources", theme, iconName));
  };

  return {
    light: pathByTheme("light"),
    dark: pathByTheme("dark"),
  };
}
