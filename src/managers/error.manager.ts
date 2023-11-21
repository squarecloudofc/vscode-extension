import * as vscode from "vscode";
import { t } from "vscode-ext-localisation";

interface CommonError {
  message: string;
  code: string;
}

class ErrorManager {
  handleError(error: CommonError, ...args: any[]) {
    console.error(error, ...args);

    if ("message" in error && "code" in error) {
      this.throwVsCodeError(error);
    }

    return undefined;
  }

  throwVsCodeError(error: CommonError) {
    vscode.window.showErrorMessage(t("generic.error", { ...error }), {
      detail: error?.message,
    });
  }
}

export default new ErrorManager();
