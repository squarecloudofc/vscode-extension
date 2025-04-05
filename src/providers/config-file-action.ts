import * as vscode from "vscode";

export class ConfigFileActionProvider implements vscode.CodeActionProvider {
	static providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

	provideCodeActions(
		document: vscode.TextDocument,
		range: vscode.Range,
	): vscode.CodeAction[] | undefined {
		const line = document.lineAt(range.start.line).text.trim();

		if (line.startsWith("AUTORESTART=")) {
			return this.getAutoRestartFixes(document, range);
		}

		if (line.startsWith("VERSION=")) {
			return this.getVersionFixes(document, range);
		}

		return undefined;
	}

	private getAutoRestartFixes(
		document: vscode.TextDocument,
		range: vscode.Range,
	): vscode.CodeAction[] {
		const fixes: vscode.CodeAction[] = [];

		for (const value of ["true", "false"]) {
			const fix = new vscode.CodeAction(
				`Set AUTORESTART=${value}`,
				vscode.CodeActionKind.QuickFix,
			);
			fix.edit = new vscode.WorkspaceEdit();
			fix.edit.replace(document.uri, range, `AUTORESTART=${value}`);
			fixes.push(fix);
		}

		return fixes;
	}

	private getVersionFixes(
		document: vscode.TextDocument,
		range: vscode.Range,
	): vscode.CodeAction[] {
		const fixes: vscode.CodeAction[] = [];

		for (const value of ["recommended", "latest"]) {
			const fix = new vscode.CodeAction(
				`Set ${value} as the version`,
				vscode.CodeActionKind.QuickFix,
			);
			fix.edit = new vscode.WorkspaceEdit();
			fix.edit.replace(document.uri, range, `VERSION=${value}`);
			fixes.push(fix);
		}

		return fixes;
	}
}
