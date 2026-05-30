import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { ApplicationCommand } from "@/structures/application/command";

const ADD_ITEM = "$(add) ";
const REMOVE_ITEM = "$(trash) ";

type EnvAction =
  | { kind: "add" }
  | { kind: "wipe" }
  | { kind: "edit"; key: string; value: string };

interface EnvQuickPickItem {
  label: string;
  description?: string;
  action: EnvAction;
}

export const envsEntry = new ApplicationCommand(
  "envsEntry",
  async (_extension, { application }) => {
    const envs = await application.envs.list().catch(() => undefined);

    if (!envs) {
      window.showErrorMessage(t("envs.loadError"));
      return;
    }

    const entries = Object.entries(envs);
    const items: EnvQuickPickItem[] = [
      { label: `${ADD_ITEM}${t("envs.addNew")}`, action: { kind: "add" } },
      ...entries.map(
        ([key, value]): EnvQuickPickItem => ({
          label: key,
          description: value,
          action: { kind: "edit", key, value },
        }),
      ),
    ];
    if (entries.length > 0) {
      items.push({
        label: `${REMOVE_ITEM}${t("envs.removeAll")}`,
        action: { kind: "wipe" },
      });
    }

    const picked = await window.showQuickPick(items, {
      title: `${t("envs.title")} - ${application.name}`,
      placeHolder: t("envs.placeholder", { COUNT: String(entries.length) }),
    });
    if (!picked) return;

    switch (picked.action.kind) {
      case "add":
        return addEnv(application);
      case "edit":
        return editEnv(application, picked.action.key, picked.action.value);
      case "wipe":
        return wipeEnvs(application);
    }
  },
);

async function addEnv(application: {
  envs: { set(envs: Record<string, string>): Promise<unknown> };
}) {
  const key = await window.showInputBox({
    title: t("envs.keyPrompt"),
    placeHolder: "KEY",
    validateInput: (text) =>
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(text) ? null : t("envs.invalidKey"),
  });
  if (!key) return;

  const value = await window.showInputBox({
    title: t("envs.valuePrompt"),
    placeHolder: "value",
  });
  if (value === undefined) return;

  await window.withProgress(
    { location: ProgressLocation.Notification, title: t("envs.saving") },
    async () => {
      await application.envs.set({ [key]: value });
      window.showInformationMessage(t("envs.saved"));
    },
  );
}

async function editEnv(
  application: {
    envs: {
      set(envs: Record<string, string>): Promise<unknown>;
      delete(keys: string[]): Promise<unknown>;
    };
  },
  key: string,
  currentValue: string,
) {
  const choice = await window.showQuickPick(
    [
      { label: t("envs.editValue"), id: "edit" as const },
      { label: t("envs.deleteOne"), id: "delete" as const },
    ],
    { title: key },
  );
  if (!choice) return;

  if (choice.id === "edit") {
    const value = await window.showInputBox({
      title: t("envs.valuePrompt"),
      value: currentValue,
    });
    if (value === undefined) return;

    await window.withProgress(
      { location: ProgressLocation.Notification, title: t("envs.saving") },
      async () => {
        await application.envs.set({ [key]: value });
        window.showInformationMessage(t("envs.saved"));
      },
    );
    return;
  }

  if (!(await confirm(t("envs.confirmDelete", { KEY: key })))) return;

  await window.withProgress(
    { location: ProgressLocation.Notification, title: t("envs.deleting") },
    async () => {
      await application.envs.delete([key]);
      window.showInformationMessage(t("envs.deleted"));
    },
  );
}

async function wipeEnvs(application: {
  envs: { replace(envs: Record<string, string>): Promise<unknown> };
}) {
  if (!(await confirm(t("envs.confirmWipe"), { destructive: true }))) return;

  await window.withProgress(
    { location: ProgressLocation.Notification, title: t("envs.deleting") },
    async () => {
      await application.envs.replace({});
      window.showInformationMessage(t("envs.deleted"));
    },
  );
}
