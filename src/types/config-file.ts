import type { ConfigFileParameters } from "@/config-file/parameters";
import type { SquareEasyExtension } from "@/managers/extension";
import type * as vscode from "vscode";

export type ConfigFileKeys = Map<string, { line: number; value: string }>;
export type ConfigFileAllowedParams = keyof typeof ConfigFileParameters;
export type ConfigFileParameter = {
	required: boolean;
	validation?: (
		keys: ConfigFileKeys,
		value: string,
		line: number,
		diagnostics: vscode.Diagnostic[],
		document: vscode.TextDocument,
		extension: SquareEasyExtension,
	) => any;
	autocomplete?: (
		document: vscode.TextDocument,
		position: vscode.Position,
	) => any;
};
