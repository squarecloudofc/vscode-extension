import { env } from "vscode";

/** The website's locales, which are also its URL prefixes. */
export type SiteLocale =
  | "pt-br"
  | "en"
  | "es"
  | "de"
  | "fr"
  | "it"
  | "ja"
  | "zh";

/**
 * The Square Cloud locale for the current VS Code language, for links into the
 * website and for formatting. Matches the translations the extension ships:
 * Simplified Chinese only, so Traditional Chinese falls back to English like
 * its UI does.
 */
export function getLocale(): SiteLocale {
  const lang = env.language.toLowerCase();
  if (lang === "pt-br") return "pt-br";
  if (lang === "zh-cn") return "zh";
  const base = lang.split("-")[0];
  if (
    base === "es" ||
    base === "de" ||
    base === "fr" ||
    base === "it" ||
    base === "ja"
  ) {
    return base;
  }
  return "en";
}

/**
 * Whether the current language puts `count` in the singular: 1 in English,
 * 0 and 1 in French, never in Japanese or Chinese. Picks between a "one" key
 * and a plural key, so no string has to say "member(s)".
 */
export function isSingular(count: number): boolean {
  return new Intl.PluralRules(getLocale()).select(count) === "one";
}
