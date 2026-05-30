import { SquareCloudAPIError } from "@squarecloud/api";
import { t } from "vscode-ext-localisation";

/**
 * Maps API error codes returned by the SDK to user-facing messages. Falls back
 * to a generic message when the code is unknown so we never surface raw error
 * payloads to the end user.
 */
export function describeError(error: unknown): string {
  if (error instanceof SquareCloudAPIError) {
    const localized = t(`apiError.${error.code}`);
    // vscode-ext-localisation returns the key itself when missing — detect
    // that and fall through to a generic message rather than showing the dot.
    if (localized !== `apiError.${error.code}`) return localized;
    return t("apiError.generic", { CODE: error.code });
  }
  if (error instanceof Error) return error.message;
  return t("generic.error");
}

export function isApiError(error: unknown): error is SquareCloudAPIError {
  return error instanceof SquareCloudAPIError;
}
