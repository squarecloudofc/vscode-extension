import * as vscode from "vscode";

export function createDiagnostic(
	document: vscode.TextDocument,
	line: number,
	message: string,
	severity = vscode.DiagnosticSeverity.Error,
): vscode.Diagnostic {
	const range = new vscode.Range(
		line,
		0,
		line,
		document.lineAt(line).text.length,
	);
	return new vscode.Diagnostic(range, message, severity);
}
