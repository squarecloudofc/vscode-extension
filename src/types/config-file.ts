import type * as vscode from "vscode";

export type ConfigFileParameter = {
	validation?: (
		keys: Set<string>,
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
