export const ExtensionID = "squarecloud";

export const Config = {
  FavoritedApps: "favApps",
};

/** Pages the extension links to. Webviews name one by key, never by URL. */
export const LINKS = {
  pricing: "https://squarecloud.app/pricing",
  status: "https://status.squarecloud.app/",
  dashboard: "https://squarecloud.app/dashboard",
  support: "https://squarecloud.app/dashboard/support",
};

/** The documentation's languages, as its URLs spell them. */
const DOCS_LOCALES = ["pt-BR", "es", "fr", "de", "it", "ja", "zh"];

/**
 * The documentation in VS Code's display language (`pt-br`, `zh-cn`, ...),
 * the way the site links it, or in English when it has no such translation.
 */
export function docsUrl(language: string): string {
  const lang = language.toLowerCase();
  const locale =
    DOCS_LOCALES.find(
      (l) => lang === l.toLowerCase() || lang.startsWith(`${l.toLowerCase()}-`),
    ) ?? "en";
  return `https://docs.squarecloud.app/${locale}`;
}

export const AllowedExtensions = [
  "js",
  "jsx",
  "mjsx",
  "cjsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mtsx",
  "ctsx",
  "mts",
  "cts",
  "py",
  "cs",
  "csproj",
  "sln",
  "dll",
  "ex",
  "exs",
  "jar",
  "rs",
  "rb",
  "php",
  "go",
  "html",
];
