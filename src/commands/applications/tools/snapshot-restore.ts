import type { Snapshot } from "@squarecloud/api";
import { ProgressLocation, window } from "vscode";
import { t } from "vscode-ext-localisation";

import { confirm } from "@/lib/utils/dialogs";
import { formatBytes } from "@/lib/utils/format";
import { ApplicationCommand } from "@/structures/application/command";
import { Logger } from "@/structures/logger";

const logger = new Logger("snapshot-restore");

interface SnapshotIds {
  snapshotId: string;
  versionId: string;
}

/**
 * Pulls the identifiers needed by `snapshots.restore()` out of a Snapshot.
 *
 * The SDK builds the URL as
 *   `https://snapshots.squarecloud.app/applications/<userId>/<name>.zip?<key>`
 * where `name` is the snapshotId (UUID v4) and `key` is a signed query string
 * that carries the versionId among its params. Neither field is exposed
 * directly on `BaseSnapshot`, so we reconstruct them from the URL.
 */
function extractIds(snapshot: Snapshot): SnapshotIds | null {
  try {
    const url = new URL(snapshot.url);
    const filename = url.pathname.split("/").pop() ?? "";
    const snapshotId = filename.replace(/\.zip$/i, "");

    const fromUrl = url.searchParams.get("versionId");
    const fromKey = new URLSearchParams(snapshot.key).get("versionId");
    const versionId = fromUrl ?? fromKey ?? null;

    if (!snapshotId || !versionId) {
      logger.warn(
        `Could not derive snapshot ids — snapshotId=${snapshotId} versionId=${versionId} key=${snapshot.key}`,
      );
      return null;
    }
    return { snapshotId, versionId };
  } catch (error) {
    logger.error("Failed to parse snapshot URL", error);
    return null;
  }
}

export const snapshotRestoreEntry = new ApplicationCommand(
  "snapshotRestoreEntry",
  async (extension, { application }) => {
    const snapshots = await application.snapshots.list().catch((error) => {
      logger.error("snapshots.list() failed", error);
      return undefined;
    });

    if (!snapshots || snapshots.length === 0) {
      window.showErrorMessage(t("snapshotRestore.noSnapshots"));
      return;
    }

    // Sort newest first — restoring almost always means "undo the last change".
    const sorted = [...snapshots].sort(
      (a, b) => b.modifiedTimestamp - a.modifiedTimestamp,
    );

    const items = sorted.map((snapshot) => ({
      label: snapshot.modifiedAt.toLocaleString(),
      description: formatBytes(snapshot.size),
      snapshot,
    }));

    const picked = await window.showQuickPick(items, {
      title: `${t("snapshotRestore.select")} - ${application.name}`,
      placeHolder: t("snapshotRestore.placeholder"),
    });
    if (!picked) return;

    const ids = extractIds(picked.snapshot);
    if (!ids) {
      // Extraction failure is logged with the raw key so the user can report
      // an example back to us if the URL format changes again.
      window.showErrorMessage(t("snapshotRestore.idExtractFailed"));
      return;
    }

    if (!(await confirm(t("snapshotRestore.confirm", { DATE: picked.label }))))
      return;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: t("snapshotRestore.loading"),
      },
      async () => {
        await application.snapshots.restore(ids);
      },
    );

    extension.api.scheduleStatusRefresh(application.id);
    window.showInformationMessage(t("snapshotRestore.loaded"));
  },
);
