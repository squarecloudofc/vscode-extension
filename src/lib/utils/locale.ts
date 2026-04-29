import { env } from "vscode";

/** Returns the Square Cloud supported locale for the current VS Code language. */
export function getLocale(): "pt-br" | "en" | "es" {
  const lang = env.language.toLowerCase();
  if (lang === "pt-br") return "pt-br";
  if (lang.startsWith("es")) return "es";
  return "en";
}
