import * as vscode from "vscode";
import { SquareCloud } from "./squarecloud";
import errorManager from "./managers/error.manager";

process.on("uncaughtException", errorManager.handleError);
process.on("unhandledRejection", errorManager.handleError);

export function activate(context: vscode.ExtensionContext) {
  console.log("[Square Cloud Easy] Extension loaded.");

  return new SquareCloud(context);
}

export function deactivate() {}
