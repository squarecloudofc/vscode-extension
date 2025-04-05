import type * as vscode from "vscode";

export type ConfigFileKeys = Map<string, { line: number; value: string }>;
export type ConfigFileParameter = {
	required: boolean;
	validation?: (
		keys: ConfigFileKeys,
		value: string,
		line: number,
		diagnostics: vscode.Diagnostic[],
		document: vscode.TextDocument,
	) => any;
	autocomplete?: (
		document: vscode.TextDocument,
		position: vscode.Position,
	) => any;
};
