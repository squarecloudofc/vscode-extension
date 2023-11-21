import { join } from "path";

export function getIcons(iconName: string) {
  const pathByTheme = (theme: "dark" | "light") => {
    return join(process.cwd(), "resources", theme, iconName);
  };

  return {
    light: pathByTheme("light"),
    dark: pathByTheme("dark"),
  };
}
