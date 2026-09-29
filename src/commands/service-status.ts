import { env, type MessageItem, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { LINKS } from "@/lib/constants";
import { Command } from "@/structures/command";

interface StatusAction extends MessageItem {
  id: "open-status-page";
}

export const showServiceStatus = new Command(
  "showServiceStatus",
  async (extension) => {
    // The SDK sends a key even for this public route, so signed out there is
    // nothing to fetch. The command is hidden then; a keybinding still lands
    // here, and the public status page answers it.
    if (!(await extension.api.getClient())) {
      env.openExternal(Uri.parse(LINKS.status));
      return;
    }

    await extension.api.refreshServiceStatus();
    const status = extension.store.value.serviceStatus;

    if (!status) {
      window.showWarningMessage(t("serviceStatus.unavailable"));
      return;
    }

    const openItem: StatusAction = {
      title: t("serviceStatus.openPage"),
      id: "open-status-page",
    };

    const labels: Record<string, string> = {
      online: t("serviceStatus.online"),
      degraded: t("serviceStatus.degraded"),
      unknown: t("serviceStatus.unknown"),
    };

    const action = await window.showInformationMessage<StatusAction>(
      t("serviceStatus.label", {
        // A status the SDK adds later still reads better raw than blank.
        STATUS: labels[status.status] ?? status.status,
        MESSAGE: status.message,
      }),
      openItem,
    );

    if (action?.id === "open-status-page") {
      env.openExternal(Uri.parse(LINKS.status));
    }
  },
);
