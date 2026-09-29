import type { AppSummary, SquareCloudAPI } from "@squarecloud/api";
import { window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { AppStatus } from "@/lib/store";
import type { SquareCloudExtension } from "@/managers/extension";
import { ExtensionID } from "@/lib/constants";
import { reportError } from "@/lib/utils/errors";

import { Logger } from "../logger";

/**
 * All these commands ever read off their argument is the application, which is
 * why the dashboard can drive them with a plain object.
 */
export interface ApplicationTarget {
  application: AppSummary;
}

export type CommandExecute = (
  extension: SquareCloudExtension,
  target: ApplicationTarget,
  api: SquareCloudAPI,
) => unknown | Promise<unknown>;

/**
 * Which applications the picker offers for a command, and why it offers none.
 * A row or the ⋯ menu passes its application straight through, unfiltered.
 */
export interface ApplicationFilter {
  accepts: (application: AppSummary, status?: AppStatus) => boolean;
  /** Shown instead of an empty picker. */
  empty: () => string;
}

/** Edge routes exist only for applications that serve a domain. */
export const isWebsite = (application: AppSummary) =>
  Boolean(application.custom ?? application.domain);
/** The metrics endpoint answers METRICS_NOT_SUPPORTED below 512 MB. */
export const hasMetrics = (application: AppSummary) => application.ram >= 512;

const logger = new Logger("AppCommand");

/**
 * Variant of `Command` for tree-item-bound actions. Identical error handling
 * to the base command — wrapped so we never let a rejected promise become a
 * silent failure in the UI. The handler gets the shared client, so it can
 * call `api.apps.*` with `application.id`; without a key there is nothing to
 * run.
 */
export class ApplicationCommand {
  public readonly name: string;

  constructor(
    name: string,
    private readonly handler: CommandExecute,
    private readonly filter?: ApplicationFilter,
  ) {
    this.name = `${ExtensionID}.${name}`;
  }

  async execute(
    extension: SquareCloudExtension,
    target?: ApplicationTarget,
  ): Promise<void> {
    try {
      const api = await extension.api.getClient();
      // Walkthrough links run these commands before anyone has connected.
      if (!api) return void (await extension.treeViews.auth.reveal());
      // A row passes its application; the palette or a walkthrough link
      // passes nothing.
      const application =
        target?.application ?? (await pickApplication(extension, this.filter));
      if (!application) return;
      await this.handler(extension, { application }, api);
    } catch (error) {
      logger.error(`Command ${this.name} failed`, error);
      reportError(extension, error);
    }
  }
}

async function pickApplication(
  extension: SquareCloudExtension,
  filter?: ApplicationFilter,
): Promise<AppSummary | undefined> {
  const { applications } = extension.store.value;
  if (!applications.size) {
    window.showInformationMessage(t("apps.noApps.message"));
    return undefined;
  }
  const { getStatus } = extension.store.actions;
  const items = Array.from(applications.values())
    .filter(
      (application) =>
        filter?.accepts(application, getStatus(application.id)) ?? true,
    )
    .map((application) => ({
      label: application.name,
      description: statusLine(getStatus(application.id)),
      application,
    }));
  if (filter && !items.length) {
    window.showInformationMessage(filter.empty());
    return undefined;
  }
  // Plain showQuickPick, not dialogs' pickOne: this module is bundled into
  // check-realtime against a minimal vscode stub.
  const picked = await window.showQuickPick(items, {
    placeHolder: t("apps.pick"),
  });
  return picked?.application;
}

/** The row's badge in words: "$(circle-filled) Online · 118 MB". */
function statusLine(status: AppStatus | undefined): string {
  if (!status) return `$(loading~spin) ${t("dashboard.unknown")}`;
  if (!status.running) return `$(circle-outline) ${t("dashboard.offline")}`;
  const ram = status.ram?.replace(/\s*MB$/i, " MB");
  return `$(circle-filled) ${t("dashboard.online")}${ram ? ` · ${ram}` : ""}`;
}
