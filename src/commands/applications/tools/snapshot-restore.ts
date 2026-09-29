import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { formatBytes } from "@/lib/utils/format";
import { getLocale } from "@/lib/utils/locale";
import { ApplicationCommand } from "@/structures/application/command";

export const snapshotRestoreEntry = new ApplicationCommand(
  "snapshotRestoreEntry",
  async (extension, { application }, api) => {
    // A failed listing is reported as what it is (offline, rate limit, plan):
    // "no snapshots" would tell someone with backups that they have none.
    const snapshots = await api.apps.snapshots.list(application.id);

    if (snapshots.length === 0) {
      window.showErrorMessage(t("snapshotRestore.noSnapshots"));
      return;
    }

    // Sort newest first — restoring almost always means "undo the last change".
    const sorted = [...snapshots].sort(
      (a, b) => Date.parse(b.modified) - Date.parse(a.modified),
    );

    const items = sorted.map((snapshot) => ({
      label: new Date(snapshot.modified).toLocaleString(getLocale()),
      description: formatBytes(snapshot.size),
      snapshot,
    }));

    const picked = await window.showQuickPick(items, {
      title: `${t("snapshotRestore.select")} - ${application.name}`,
      placeHolder: t("snapshotRestore.placeholder"),
    });
    if (!picked) return;

    if (!(await confirm(t("snapshotRestore.confirm", { DATE: picked.label }))))
      return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("snapshotRestore.loading"),
      },
      // The listing carries exactly what restore takes: its `name` and
      // `version_id`.
      () =>
        api.apps.snapshots.restore(
          application.id,
          picked.snapshot.name,
          picked.snapshot.version_id,
        ),
    );

    extension.api.scheduleStatusRefresh(application.id);
    window.showInformationMessage(t("snapshotRestore.loaded"));
  },
);
