import { env, ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import type { WorkspaceTreeItem } from "@/treeviews/workspaces/item";
import { confirm } from "@/lib/utils/dialogs";
import { Command } from "@/structures/command";

export const createWorkspace = new Command(
  "createWorkspace",
  async (extension) => {
    const name = await window.showInputBox({
      title: t("workspace.createTitle"),
      placeHolder: t("workspace.namePrompt"),
      validateInput: (text) =>
        text.length >= 1 && text.length <= 32
          ? null
          : t("workspace.invalidName"),
    });
    if (!name) return;

    const api = await extension.api.getClient();
    if (!api) return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("workspace.creating"),
      },
      async () => {
        await api.workspaces.create({ name });
        await extension.api.refresh();
        window.showInformationMessage(t("workspace.created"));
      },
    );
  },
);

export const deleteWorkspace = new Command(
  "deleteWorkspace",
  async (extension, item: WorkspaceTreeItem) => {
    const typed = await window.showInputBox({
      title: t("workspace.deleteConfirm", { NAME: item.workspace.name }),
      placeHolder: item.workspace.name,
    });
    if (typed !== item.workspace.name) return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("workspace.deleting"),
      },
      async () => {
        await item.workspace.delete();
        await extension.api.refresh();
        window.showInformationMessage(t("workspace.deleted"));
      },
    );
  },
);

export const leaveWorkspace = new Command(
  "leaveWorkspace",
  async (extension, item: WorkspaceTreeItem) => {
    if (
      !(await confirm(
        t("workspace.leaveConfirm", { NAME: item.workspace.name }),
      ))
    )
      return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("workspace.leaving"),
      },
      async () => {
        await item.workspace.leave();
        await extension.api.refresh();
        window.showInformationMessage(t("workspace.left"));
      },
    );
  },
);

export const generateInviteCode = new Command(
  "generateInviteCode",
  async (extension) => {
    const api = await extension.api.getClient();
    if (!api) return;

    const code = await api.workspaces.generateInviteCode();
    await env.clipboard.writeText(code);
    window.showInformationMessage(t("workspace.inviteCopied", { CODE: code }));
  },
);

export const refreshWorkspaces = new Command("refreshWorkspaces", (extension) =>
  extension.api.refresh(),
);
