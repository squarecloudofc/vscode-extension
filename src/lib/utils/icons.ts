import { join } from "node:path";

export function getIcons(iconName: string) {
	const pathByTheme = (theme: "dark" | "light") => {
		return join(__dirname, "..", "..", "..", "resources", theme, iconName);
	};

	return {
		light: pathByTheme("light"),
		dark: pathByTheme("dark"),
	};
}
