import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

import type {
  ConfigFileAllowedParams,
  ConfigFileKeys,
} from "@/types/config-file";
import { ConfigFileParameters } from "@/config-file/parameters";
import { getLocale } from "@/lib/utils/locale";
import { isRequired } from "@/types/config-file";

/**
 * Hovering a key of `squarecloud.app` shows what it does, whether this file
 * needs it (the same rule the validation applies) and a link to its section
 * of the reference.
 */
export const ConfigHoverProvider: vscode.HoverProvider = {
  provideHover(document, position) {
    // Keys start the line, as the validation reads them.
    const range = document.getWordRangeAtPosition(position, /[A-Z_]+(?==)/);
    if (range?.start.character !== 0) return undefined;
    const key = document.getText(range);
    if (!(key in ConfigFileParameters)) return undefined;
    const parameter = ConfigFileParameters[key as ConfigFileAllowedParams];

    const keys: ConfigFileKeys = new Map();
    document
      .getText()
      .split(/\r?\n/g)
      .forEach((line, index) => {
        const [name, ...rest] = line.split("=");
        if (name.trim() && !keys.has(name))
          keys.set(name, { line: index, value: rest.join("=") });
      });

    const status = isRequired(parameter, keys)
      ? t("configFile.hover.required")
      : t("configFile.hover.optional");
    const reference = `https://docs.squarecloud.app/${getLocale()}/getting-started/config-file#${key.toLowerCase()}`;
    const markdown = new vscode.MarkdownString(
      `**${key}** · ${status}\n\n${parameter.docs()}\n\n[${t("configFile.hover.reference")}](${reference})`,
    );
    return new vscode.Hover(markdown, range);
  },
};
