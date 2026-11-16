import { t } from "../../l10n";

/** Each `lang` the API answers, as people write it. */
const NAMES: Record<string, string> = {
  javascript: "JavaScript",
  nodejs: "Node.js",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  kotlin: "Kotlin",
  rust: "Rust",
  ruby: "Ruby",
  php: "PHP",
  go: "Go",
  golang: "Go",
  csharp: "C#",
  dotnet: ".NET",
  cplusplus: "C++",
  elixir: "Elixir",
};

export const runtimeName = (lang: string) => {
  const key = lang.toLowerCase();
  return key === "static" || key === "html"
    ? t("app.static")
    : (NAMES[key] ?? lang);
};
