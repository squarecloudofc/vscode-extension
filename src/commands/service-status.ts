import { env, type MessageItem, Uri, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { Command } from "@/structures/command";

interface StatusAction extends MessageItem {
  id: "open-status-page";
}

export const showServiceStatus = new Command(
  "showServiceStatus",
  async (extension) => {
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

    const action = await window.showInformationMessage<StatusAction>(
      t("serviceStatus.label", {
        STATUS: status.status,
        MESSAGE: status.message,
      }),
      openItem,
    );

    if (action?.id === "open-status-page") {
      env.openExternal(Uri.parse("https://status.squarecloud.app/"));
    }
  },
);
