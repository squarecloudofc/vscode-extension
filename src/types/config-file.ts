import type * as vscode from "vscode";

import type { ConfigFileParameters } from "@/config-file/parameters";
import type { SquareCloudExtension } from "@/managers/extension";

export type ConfigFileKeys = Map<string, { line: number; value: string }>;
export type ConfigFileAllowedParams = keyof typeof ConfigFileParameters;
export type ConfigFileParameter = {
  /**
   * Whether the parameter must be present. A function form is supported for
   * fields whose requirement depends on the presence of other fields (e.g.
   * MAIN is only required when START is absent).
   */
  required: boolean | ((keys: ConfigFileKeys) => boolean);
  validation?: (
    keys: ConfigFileKeys,
    value: string,
    line: number,
    diagnostics: vscode.Diagnostic[],
    document: vscode.TextDocument,
    extension: SquareCloudExtension,
  ) => any;
  autocomplete?: (
    document: vscode.TextDocument,
    position: vscode.Position,
  ) => any;
};

export function isRequired(
  parameter: ConfigFileParameter,
  keys: ConfigFileKeys,
): boolean {
  return typeof parameter.required === "function"
    ? parameter.required(keys)
    : parameter.required;
}
