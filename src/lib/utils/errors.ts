import { APIErrorCode, SquareCloudAPIError } from "@squarecloud/api";
import { t } from "vscode-ext-localisation";

/**
 * Maps API error codes returned by the SDK to user-facing messages. Falls back
 * to a generic message when the code is unknown so we never surface raw error
 * payloads to the end user.
 *
 * During the API's naming transition legacy codes (e.g. `FEW_MEMORY`) may
 * still arrive — `APIErrorCode` maps them to their canonical names
 * (`INSUFFICIENT_MEMORY`), so we try the alias before giving up.
 */
export function describeError(error: unknown): string {
  if (error instanceof SquareCloudAPIError) {
    const canonical = (APIErrorCode as Record<string, APIErrorCode>)[
      error.code
    ];
    const localized = localize(error.code) ?? localize(canonical);
    return localized ?? t("apiError.generic", { CODE: error.code });
  }
  if (error instanceof Error) return error.message;
  return t("generic.error");
}

function localize(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const localized = t(`apiError.${code}`);
  // vscode-ext-localisation returns the key itself when missing — detect
  // that and fall through rather than showing the dotted key.
  return localized === `apiError.${code}` ? undefined : localized;
}

export function isApiError(error: unknown): error is SquareCloudAPIError {
  return error instanceof SquareCloudAPIError;
}
