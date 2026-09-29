import { SquareCloudAPIError } from "@squarecloud/api";
import { commands, env, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { SquareCloudExtension } from "@/managers/extension";
import { ExtensionID, LINKS } from "@/lib/constants";

/**
 * What kind of trouble an error is, from the user's side: it picks the
 * picture, the words and the one button that helps. Everything unlisted is a
 * plain `error`.
 */
export type ProblemKind =
  | "offline"
  | "session"
  | "rateLimit"
  | "keyLimit"
  | "outage"
  | "plan"
  | "notFound"
  | "error";

/**
 * Only codes the SDK declares, plus the authorize flow's own (localised under
 * `apiError.*`). `check-problems` fails on anything else.
 */
export const PROBLEM_CODES: Record<Exclude<ProblemKind, "error">, string[]> = {
  offline: ["NETWORK_ERROR", "TIMEOUT"],
  session: [
    "INVALID_ACCESS_TOKEN",
    "ACCESS_DENIED",
    "MISSING_SCOPE",
    "RESOURCE_NOT_ALLOWED",
    "INVALID_GRANT",
    "INVALID_VERIFIER",
    "INVALID_REDIRECT_URI",
  ],
  rateLimit: ["RATE_LIMITED", "KEEP_CALM", "RATE_LIMIT"],
  keyLimit: ["APIKEY_LIMIT_REACHED"],
  outage: [
    "CLUSTER_MAINTENANCE_TRY_LATER",
    "DATABASE_UNAVAILABLE",
    "ACTION_FAILED",
    "CONTAINER_NOT_FOUND",
    "CONTAINER_NETWORK_CONFLICT",
    "UPLOAD_BUSY",
    "ANALYTICS_BUSY",
  ],
  plan: [
    "UPGRADE_REQUIRED",
    "INSUFFICIENT_MEMORY",
    "APPLICATIONS_LIMIT_REACHED",
    "WORKSPACE_LIMIT_REACHED",
    "MEMBERS_LIMIT_REACHED",
    "LOAD_BALANCER_LIMIT_REACHED",
    "DAILY_SNAPSHOTS_LIMIT_REACHED",
  ],
  notFound: ["APP_NOT_FOUND", "DATABASE_NOT_FOUND", "WORKSPACE_NOT_FOUND"],
};

const KIND_OF = new Map(
  Object.entries(PROBLEM_CODES).flatMap(([kind, codes]) =>
    codes.map((code) => [code, kind as ProblemKind]),
  ),
);

/** Classifies an error, or a bare code. An unknown 429 or 5xx still counts. */
export function problemOf(errorOrCode: unknown): ProblemKind {
  const code = isApiError(errorOrCode) ? errorOrCode.code : errorOrCode;
  const kind = typeof code === "string" ? KIND_OF.get(code) : undefined;
  if (kind) return kind;
  const status = isApiError(errorOrCode) ? errorOrCode.status : 0;
  if (status === 429) return "rateLimit";
  if (status >= 500) return "outage";
  return "error";
}

/**
 * A 409 that only says the app is already where the user wanted it: worth
 * telling, not worth an error toast.
 */
const INFORMATIONAL_CODES = new Set([
  "CONTAINER_ALREADY_STARTED",
  "CONTAINER_ALREADY_STOPPED",
]);

/**
 * Maps API error codes returned by the SDK to user-facing messages. Falls back
 * to a generic message with the code when there is no translation, so we never
 * surface raw error payloads to the end user.
 */
export function describeError(error: unknown): string {
  if (error instanceof SquareCloudAPIError) return describeCode(error.code);
  if (error instanceof Error) return error.message;
  return t("generic.error");
}

/** Same lookup as `describeError`, for codes that arrive without an Error. */
export function describeCode(code: string): string {
  return localize(code) ?? t("apiError.generic", { CODE: code });
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

/** `RATE_LIMITED` (a block of up to ~30 min) or a short `KEEP_CALM` burst. */
export function isRateLimited(error: unknown): error is SquareCloudAPIError {
  return isApiError(error) && error.status === 429;
}

export function isInformational(error: unknown): boolean {
  return isApiError(error) && INFORMATIONAL_CODES.has(error.code);
}

/** The one button that helps with each kind of problem, if any does. */
function actionFor(
  kind: ProblemKind,
): { title: string; run: () => unknown } | undefined {
  switch (kind) {
    case "session":
      return {
        title: t("command.setApiKey"),
        run: () => commands.executeCommand(`${ExtensionID}.setApiKey`),
      };
    case "plan":
      return {
        title: t("problem.plan.action"),
        run: () => env.openExternal(Uri.parse(LINKS.pricing)),
      };
    case "rateLimit":
    case "outage":
      return {
        title: t("serviceStatus.title"),
        run: () => commands.executeCommand(`${ExtensionID}.showServiceStatus`),
      };
  }
}

/**
 * How every command reports a failure. A 401 `ACCESS_DENIED` re-checks the
 * account: when the key itself is dead, that refresh drops it and asks to
 * connect again — the same path a rejected poll takes. A 404 means the row
 * was stale, so the same quiet refresh makes it disappear.
 */
export function reportError(
  extension: SquareCloudExtension,
  error: unknown,
): void {
  // The user backed out (vscode.CancellationError, or VS Code's own "Canceled"):
  // nothing failed, so there is nothing to report.
  if (error instanceof Error && error.name === "Canceled") return;
  const kind = problemOf(error);
  if (
    kind === "notFound" ||
    (isApiError(error) && error.code === "ACCESS_DENIED")
  ) {
    void extension.api.refresh();
  }
  if (isInformational(error)) {
    window.showInformationMessage(describeError(error));
    return;
  }
  const action = actionFor(kind);
  void window
    .showErrorMessage(describeError(error), ...(action ? [action.title] : []))
    .then((picked) => {
      if (picked) action?.run();
    });
}
