import type { SquareCloudAPI } from "@squarecloud/api";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { isSingular } from "@/lib/utils/locale";
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
  async (_extension, { application }, api) => {
    const envs = await api.apps.envs.get(application.id).catch(() => undefined);

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
      // Two t() calls, not t(ternary): check-strings only sees literal keys.
      placeHolder: isSingular(entries.length)
        ? t("envs.placeholderOne", { COUNT: String(entries.length) })
        : t("envs.placeholder", { COUNT: String(entries.length) }),
    });
    if (!picked) return;

    switch (picked.action.kind) {
      case "add":
        return addEnv(api, application.id);
      case "edit":
        return editEnv(
          api,
          application.id,
          picked.action.key,
          picked.action.value,
        );
      case "wipe":
        return wipeEnvs(api, application.id);
    }
  },
);

async function addEnv(api: SquareCloudAPI, appId: string) {
  const key = await window.showInputBox({
    title: t("envs.keyPrompt"),
    placeHolder: "KEY",
    validateInput: (text) =>
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(text) ? null : t("envs.invalidKey"),
  });
  if (!key) return;

  const value = await window.showInputBox({
    title: t("envs.valuePrompt"),
  });
  if (value === undefined) return;

  await window.withProgress(
    { location: ProgressLocation.Notification, title: t("envs.saving") },
    async () => {
      await api.apps.envs.set(appId, { [key]: value });
      window.showInformationMessage(t("envs.saved"));
    },
  );
}

async function editEnv(
  api: SquareCloudAPI,
  appId: string,
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
        await api.apps.envs.set(appId, { [key]: value });
        window.showInformationMessage(t("envs.saved"));
      },
    );
    return;
  }

  if (!(await confirm(t("envs.confirmDelete", { KEY: key })))) return;

  await window.withProgress(
    { location: ProgressLocation.Notification, title: t("envs.deleting") },
    async () => {
      await api.apps.envs.delete(appId, [key]);
      window.showInformationMessage(t("envs.deleted"));
    },
  );
}

async function wipeEnvs(api: SquareCloudAPI, appId: string) {
  if (!(await confirm(t("envs.confirmWipe"), { destructive: true }))) return;

  await window.withProgress(
    { location: ProgressLocation.Notification, title: t("envs.deleting") },
    async () => {
      await api.apps.envs.replace(appId, {});
      window.showInformationMessage(t("envs.deleted"));
    },
  );
}
