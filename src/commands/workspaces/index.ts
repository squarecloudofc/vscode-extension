import type { Workspace } from "@squarecloud/api";
import { commands, env, ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { ExtensionID } from "@/lib/constants";
import { confirm } from "@/lib/utils/dialogs";
import { Command } from "@/structures/command";

export const createWorkspace = new Command(
  "createWorkspace",
  async (extension) => {
    const api = await extension.api.getClient();
    if (!api) return extension.views.sidebar.signIn();

    const name = await window.showInputBox({
      title: t("workspace.createTitle"),
      placeHolder: t("workspace.namePrompt"),
      validateInput: (text) =>
        text.length >= 1 && text.length <= 32
          ? null
          : t("workspace.invalidName"),
    });
    if (!name) return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("workspace.creating"),
      },
      async () => {
        await api.workspaces.create(name);
        await extension.api.refresh();
      },
    );
  },
);

export const deleteWorkspace = new Command(
  "deleteWorkspace",
  async (extension, item: { workspace: Workspace }) => {
    const api = await extension.api.getClient();
    if (!api) return;

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
        await api.workspaces.delete(item.workspace.id);
        await extension.api.refresh();
      },
    );
  },
);

export const leaveWorkspace = new Command(
  "leaveWorkspace",
  async (extension, item: { workspace: Workspace }) => {
    const api = await extension.api.getClient();
    if (!api) return;

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
        await api.workspaces.leave(item.workspace.id);
        await extension.api.refresh();
      },
    );
  },
);

/** The workspace's panel: from the sidebar's switcher, or picked here. */
export const openWorkspace = new Command(
  "openWorkspace",
  async (extension, item?: { workspace: Workspace }) => {
    if (!(await extension.api.getClient()))
      return extension.views.sidebar.signIn();
    const { workspaces } = extension.store.value;
    if (!item && !workspaces.length) {
      const create = t("command.createWorkspace");
      if (
        (await window.showInformationMessage(t("workspace.none"), create)) ===
        create
      )
        await commands.executeCommand(`${ExtensionID}.createWorkspace`);
      return;
    }
    const workspace =
      item?.workspace ??
      (
        await window.showQuickPick(
          workspaces.map((w) => ({
            label: w.name,
            description: w.id,
            workspace: w,
          })),
          { placeHolder: t("workspace.pick") },
        )
      )?.workspace;
    if (workspace) extension.panels.openResource("workspace", workspace.id);
  },
);

export const generateInviteCode = new Command(
  "generateInviteCode",
  async (extension) => {
    const api = await extension.api.getClient();
    if (!api) return extension.views.sidebar.signIn();

    const code = await api.workspaces.members.inviteCode();
    await env.clipboard.writeText(code);
    window.showInformationMessage(t("workspace.inviteCopied", { CODE: code }));
  },
);
