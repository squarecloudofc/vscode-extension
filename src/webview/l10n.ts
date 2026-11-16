// The strings the host resolved for this view (`renderShell`'s `l10n`), read
// the way vscode-ext-localisation reads them: `{{NAME}}` placeholders, and the
// key itself when a string is missing.

let strings: Record<string, string> = {};

export function setStrings(next: Record<string, string>): void {
  strings = next;
}

export function t(key: string, values?: Record<string, string | number>) {
  const text = strings[key] ?? key;
  return values
    ? text.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
        name in values ? String(values[name]) : match,
      )
    : text;
}

/** The VS Code display language (`<html lang>`), for Intl formatting. */
export const locale = () => document.documentElement.lang || "en";
