// Runtime and database logos, copied from the site into resources/brand
// (apps/website/public/assets/{languages,databases}). The site names each file
// after the API's own value, an app's `lang` (`javascript.svg`) or a
// database's `type` (`postgres.svg`), so that value is the lookup key here
// too. No imports: `node --test` loads this file.

/** Every `lang` the platform runs, as the site names its logos. */
const LANGUAGES = new Set([
  "javascript",
  "nodejs",
  "typescript",
  "python",
  "java",
  "kotlin",
  "rust",
  "ruby",
  "php",
  "go",
  "csharp",
  "dotnet",
  "cplusplus",
  "elixir",
  "static",
]);

/** Spellings the API also accepts (the config file's RUNTIME aliases). */
const ALIASES: Record<string, string> = {
  golang: "go",
  html: "static",
  "c#": "csharp",
  rb: "ruby",
};

const DATABASES = new Set(["mongo", "mysql", "postgres", "redis"]);

let base = "";

/** Set once from the shell's boot data: the webview URL of resources/brand. */
export function setLogoBase(url: string): void {
  base = url.replace(/\/+$/, "");
}

/** The file under resources/brand, or undefined for an unknown value. */
export function logoPath(
  kind: "app" | "database",
  value: string | null | undefined,
): string | undefined {
  const name = (value ?? "").trim().toLowerCase();
  if (kind === "database")
    return DATABASES.has(name) ? `databases/${name}.svg` : undefined;
  const file = ALIASES[name] ?? name;
  return LANGUAGES.has(file) ? `languages/${file}.svg` : undefined;
}

/**
 * The logo of an app's `lang` or a database's engine, or undefined: then
 * <Logo> draws the neutral fallback. Panels reuse this.
 */
export function logoUrl(
  kind: "app" | "database",
  value: string | null | undefined,
): string | undefined {
  const path = logoPath(kind, value);
  return path && `${base}/${path}`;
}

/**
 * The Square Cloud mark: the two paths of the site's logo-mark.tsx as one,
 * on a 512 grid, for currentColor. Also drawn by the browser page that
 * closes the sign-in (src/lib/api-key/authorize.ts).
 */
export const LOGO_MARK =
  "M125.741 64.755H448v320.75h-61.741v61.74H64v-320.75h61.741zm19.577 19.576v42.164h240.941v239.433h42.165V84.331zM89.6 152.095v269.551h271.059V152.095zM125.741 159.624h19.577v206.304h207.812v19.577H125.741z";
